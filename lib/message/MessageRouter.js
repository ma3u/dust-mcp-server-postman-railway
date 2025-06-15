import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles routing and delivery of messages within the MCP server.
 * Manages message queues, rate limiting, and delivery to the appropriate handlers.
 */
export class MessageRouter extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {SessionManager} options.sessionManager - Instance of SessionManager
   * @param {number} [options.maxConcurrent=5] - Maximum concurrent messages per session
   * @param {number} [options.rateLimitWindow=1000] - Rate limit window in ms
   * @param {number} [options.rateLimitMax=10] - Maximum messages per window
   */
  constructor({ 
    sessionManager, 
    maxConcurrent = 5, 
    rateLimitWindow = 1000, 
    rateLimitMax = 10 
  } = {}) {
    super();
    
    if (!sessionManager) {
      throw new Error('SessionManager is required');
    }
    
    this.sessionManager = sessionManager;
    this.maxConcurrent = maxConcurrent;
    this.rateLimitWindow = rateLimitWindow;
    this.rateLimitMax = rateLimitMax;
    
    // Track rate limits by session ID
    this.rateLimits = new Map();
    
    // Track active message counts by session ID
    this.activeCounts = new Map();
    
    // Message queues by session ID
    this.queues = new Map();
    
    // Bind methods
    this.processQueue = this.processQueue.bind(this);
  }
  
  /**
   * Check if a message is allowed based on rate limits
   * @private
   * @param {string} sessionId - The session ID
   * @returns {boolean} True if allowed, false if rate limited
   */
  _checkRateLimit(sessionId) {
    const now = Date.now();
    const sessionLimit = this.rateLimits.get(sessionId) || { count: 0, resetTime: 0 };
    
    // Reset counter if window has passed
    if (now >= sessionLimit.resetTime) {
      sessionLimit.count = 0;
      sessionLimit.resetTime = now + this.rateLimitWindow;
    }
    
    // Check if rate limited
    if (sessionLimit.count >= this.rateLimitMax) {
      return false;
    }
    
    // Increment counter
    sessionLimit.count++;
    this.rateLimits.set(sessionId, sessionLimit);
    return true;
  }
  
  /**
   * Process the next message in the queue for a session
   * @private
   * @param {string} sessionId - The session ID
   */
  async processQueue(sessionId) {
    const queue = this.queues.get(sessionId) || [];
    const activeCount = this.activeCounts.get(sessionId) || 0;
    
    // If queue is empty or we've hit concurrency limit, stop processing
    if (queue.length === 0 || activeCount >= this.maxConcurrent) {
      return;
    }
    
    // Get next message from queue
    const { message, resolve, reject } = queue.shift();
    
    // Update active count
    this.activeCounts.set(sessionId, activeCount + 1);
    
    try {
      // Check rate limit
      if (!this._checkRateLimit(sessionId)) {
        throw new Error('Rate limit exceeded');
      }
      
      // Get session and validate
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }
      
      // Emit message processing event
      this.emit('message:processing', { sessionId, message });
      
      // Process the message (this would be connected to your actual message handler)
      const result = await this._processMessage(session, message);
      
      // Emit completion event
      this.emit('message:complete', { sessionId, message, result });
      
      // Resolve the promise
      resolve(result);
    } catch (error) {
      // Emit error event
      this.emit('message:error', { sessionId, message, error });
      
      // Reject the promise
      reject(error);
    } finally {
      // Update active count
      const newCount = (this.activeCounts.get(sessionId) || 1) - 1;
      this.activeCounts.set(sessionId, newCount);
      
      // Process next message in queue
      setImmediate(() => this.processQueue(sessionId));
    }
  }
  
  /**
   * Process a message (to be implemented by subclasses or extended)
   * @protected
   * @param {Object} session - The session object
   * @param {Object} message - The message to process
   * @returns {Promise<Object>} The processing result
   */
  async _processMessage(session, message) {
    // This should be overridden by subclasses or monkey-patched
    // to provide actual message processing logic
    return { status: 'processed', messageId: message.id };
  }
  
  /**
   * Queue a message for processing
   * @param {string} sessionId - The session ID
   * @param {Object} message - The message to process
   * @returns {Promise<Object>} Resolves when the message is processed
   */
  async queueMessage(sessionId, message) {
    // Ensure message has an ID
    if (!message.id) {
      message.id = uuidv4();
    }
    
    // Create a new queue if it doesn't exist
    if (!this.queues.has(sessionId)) {
      this.queues.set(sessionId, []);
      this.activeCounts.set(sessionId, 0);
    }
    
    // Create a promise that will be resolved when the message is processed
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(sessionId);
      
      // Add to queue
      queue.push({
        message,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Process the queue
      setImmediate(() => this.processQueue(sessionId));
    });
  }
  
  /**
   * Get queue status for a session
   * @param {string} sessionId - The session ID
   * @returns {Object} Queue status
   */
  getQueueStatus(sessionId) {
    const queue = this.queues.get(sessionId) || [];
    const activeCount = this.activeCounts.get(sessionId) || 0;
    const rateLimit = this.rateLimits.get(sessionId) || { count: 0, resetTime: 0 };
    
    return {
      queued: queue.length,
      active: activeCount,
      rateLimited: rateLimit.count >= this.rateLimitMax,
      rateLimit: {
        current: rateLimit.count,
        max: this.rateLimitMax,
        resetIn: Math.max(0, rateLimit.resetTime - Date.now())
      },
      maxConcurrent: this.maxConcurrent
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clear any intervals or timeouts
    this.removeAllListeners();
    
    // Clear queues
    this.queues.clear();
    this.activeCounts.clear();
    this.rateLimits.clear();
  }
}

export default MessageRouter;
