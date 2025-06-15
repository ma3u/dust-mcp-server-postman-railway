import { EventEmitter } from 'events';
import { AbortController } from 'node-abort-controller';

// Default configuration
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000,    // 10 seconds
  factor: 2,
  timeout: 30000,     // 30 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
};

/**
 * Handles streaming responses from the Dust API with enhanced error handling and retry logic.
 * Manages event streams and forwards chunks to session listeners.
 */
export class StreamingHandler extends EventEmitter {
  /**
   * @param {Object} sessionManager - Instance of SessionManager
   * @param {Object} [config] - Configuration options
   * @param {string} [config.baseUrl='https://dust.tt'] - Base URL for the Dust API
   * @param {Object} [config.retry] - Retry configuration
   * @param {number} [config.retry.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [config.retry.initialDelay=1000] - Initial delay between retries in ms
   * @param {number} [config.retry.maxDelay=10000] - Maximum delay between retries in ms
   * @param {number} [config.retry.factor=2] - Exponential backoff factor
   * @param {number} [config.retry.timeout=30000] - Request timeout in ms
   */
  constructor(sessionManager, config = {}) {
    super();
    this.sessionManager = sessionManager;
    this.baseUrl = config.baseUrl || 'https://dust.tt';
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...(config.retry || {}) };
    this.activeRequests = new Map();
  }

  /**
   * Calculate delay for retry with exponential backoff and jitter
   * @private
   */
  _calculateDelay(attempt) {
    const { initialDelay, maxDelay, factor } = this.retryConfig;
    const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
    return delay * (0.5 + Math.random() * 0.5); // Add jitter
  }

  /**
   * Check if an error is retryable
   * @private
   */
  _isRetryableError(error) {
    if (this.retryConfig.retryableErrors.includes(error.code)) return true;
    if (error.status && this.retryConfig.retryableStatuses.includes(error.status)) return true;
    return false;
  }

  /**
   * Make a fetch request with retry logic
   * @private
   */
  async _fetchWithRetry(url, options, sessionId, attempt = 0) {
    const { maxRetries, timeout } = this.retryConfig;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Store the controller for potential cancellation
    this.activeRequests.set(sessionId, { controller, timeoutId });

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      this.activeRequests.delete(sessionId);

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(sessionId);

      if (error.name === 'AbortError') {
        error.message = `Request timed out after ${timeout}ms`;
      }

      if (attempt < maxRetries && this._isRetryableError(error)) {
        const delay = this._calculateDelay(attempt);
        this.emit('retry', { attempt, delay, error, sessionId });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchWithRetry(url, options, sessionId, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Cancel an active request
   * @param {string} sessionId - The session ID to cancel the request for
   */
  cancelRequest(sessionId) {
    const request = this.activeRequests.get(sessionId);
    if (request) {
      const { controller, timeoutId } = request;
      clearTimeout(timeoutId);
      controller.abort();
      this.activeRequests.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Streams a response from the Dust API with retry and error handling
   * @param {string} sessionId - The session ID
   * @param {string} message - The message to send
   * @param {Object} [options] - Additional options
   * @param {AbortSignal} [options.signal] - Optional AbortSignal for cancellation
   * @returns {AsyncGenerator<Object>} Yields response chunks
   */
  async *streamResponse(sessionId, message, options = {}) {
    let session;
    try {
      session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }

      const { workspaceId, conversationId } = session;
      const url = conversationId 
        ? `${this.baseUrl}/api/conversations/${conversationId}/messages`
        : `${this.baseUrl}/api/conversations`;

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DUST_API_KEY}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message,
          agentId: session.agentId,
          stream: true
        })
      };

      // Add signal to fetch options if provided
      if (options.signal) {
        fetchOptions.signal = options.signal;
      }

      const response = await this._fetchWithRetry(url, fetchOptions, sessionId);

      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstChunk = true;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              // Update session with conversation ID if this is the first message
              if (isFirstChunk && data.conversationId && !session.conversationId) {
                this.sessionManager.setConversationId(sessionId, data.conversationId);
                isFirstChunk = false;
              }
              
              // Notify all listeners
              if (session.listeners) {
                for (const listener of session.listeners) {
                  try {
                    listener(data);
                  } catch (error) {
                    this.emit('error', { error, context: 'listener', sessionId });
                  }
                }
              }
              
              // Yield the data to the generator
              yield data;
            } catch (error) {
              this.emit('error', { 
                error: new Error(`Failed to parse chunk: ${error.message}`),
                context: 'parse',
                sessionId,
                chunk: line
              });
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch (error) {
          this.emit('error', { error, context: 'cleanup', sessionId });
        }
        this.activeRequests.delete(sessionId);
      }
    } catch (error) {
      const errorContext = {
        error,
        context: 'stream',
        sessionId,
        sessionExists: !!session,
        message: error.message
      };
      
      this.emit('error', errorContext);
      
      // Re-throw with additional context if it's not an abort error
      if (error.name !== 'AbortError') {
        const enhancedError = new Error(`Streaming failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.context = errorContext;
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Cancel all active requests
    for (const [sessionId] of this.activeRequests) {
      this.cancelRequest(sessionId);
    }
    this.removeAllListeners();
  }
}
