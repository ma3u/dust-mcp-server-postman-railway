// Mock node-fetch at the very top
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

// Mock node-abort-controller at the very top
jest.mock('node-abort-controller');

const { StreamingHandler } = require('../lib/streamingHandler.js');
const { EventEmitter } = require('events');
const { createMockSession, createMockSessionManager } = require('./testUtils.js');

// global.AbortController = MockAbortController; // Replaced by module mock

// Mock TextDecoder
class MockTextDecoder {
  constructor() {
    this.decode = jest.fn((value, options) => {
      if (options?.stream) return value ? value.toString() : '';
      return value ? value.toString() : '';
    });
  }
}

global.TextDecoder = MockTextDecoder;

describe('StreamingHandler', () => {
  // Helper functions for creating mock stream chunks
  const mockChunk = (data) => {
    const json = JSON.stringify(data);
    const chunk = `data: ${json}\n`;
    return { value: new TextEncoder().encode(chunk), done: false };
  };

  const mockEnd = () => ({
    value: undefined,
    done: true
  });
  let sessionManager;
  let handler;
  let mockResponse;
  let mockReader;
  let onAbort;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock session manager
    sessionManager = {
      getSession: jest.fn(),
      setConversationId: jest.fn()
    };

    // Create a mock response
    mockReader = {
      read: jest.fn(),
      releaseLock: jest.fn()
    };

    mockResponse = {
      ok: true,
      status: 200,
      body: {
        getReader: jest.fn(() => mockReader)
      }
    };

    // Mock fetch implementation
    mockFetch.mockResolvedValue(mockResponse);

    // Create handler instance
    handler = new StreamingHandler(sessionManager, {
      baseUrl: 'https://dust.test',
      retry: {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100,
        timeout: 100
      }
    });
  });

  afterEach(() => {
    handler.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultHandler = new StreamingHandler(sessionManager);
      expect(defaultHandler.baseUrl).toBe('https://dust.tt');
      expect(defaultHandler.retryConfig.maxRetries).toBe(3);
    });

    it('should override default config', () => {
      expect(handler.baseUrl).toBe('https://dust.test');
      expect(handler.retryConfig.maxRetries).toBe(2);
    });
  });

  describe('streamResponse', () => {
    const sessionId = 'test-session';
    const message = 'Test message';
    const conversationId = 'test-conversation';


    const testSession = {
      id: sessionId,
      agentId: 'test-agent',
      conversationId: null,
      listeners: new Set()
    };

    beforeEach(() => {
      sessionManager.getSession.mockReturnValue({ ...testSession });
    });


    it('should stream response successfully', async () => {
      // Mock reader with two chunks and then done
      mockReader.read
        .mockResolvedValueOnce(mockChunk({ content: 'Hello' }))
        .mockResolvedValueOnce(mockChunk({ content: ' World' }))
        .mockResolvedValueOnce(mockEnd());

      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, message)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: 'Hello' },
        { content: ' World' }
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://dust.test/api/conversations',
        expect.any(Object)
      );
    });

    it('should handle conversation ID in first chunk', async () => {
      const conversationUpdate = { conversationId };
      
      mockReader.read
        .mockResolvedValueOnce(mockChunk({ ...conversationUpdate, content: 'Hello' }))
        .mockResolvedValueOnce(mockEnd());

      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, message)) {
        chunks.push(chunk);
      }

      expect(sessionManager.setConversationId).toHaveBeenCalledWith(sessionId, conversationId);
      expect(chunks[0]).toMatchObject(conversationUpdate);
    });

    it('should retry on network error', async () => {
      // First two attempts fail with network error
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          ...mockResponse,
          body: {
            getReader: () => ({
              read: jest.fn()
                .mockResolvedValueOnce(mockChunk({ content: 'Retry success' }))
                .mockResolvedValueOnce(mockEnd()),
              releaseLock: jest.fn()
            })
          }
        });

      const retryListener = jest.fn();
      handler.on('retry', retryListener);

      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, message)) {
        chunks.push(chunk);
      }

      expect(retryListener).toHaveBeenCalledTimes(2);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Retry success');
    });

    it('should handle request cancellation', async () => {
      const abortController = new AbortController();
      
      // Mock a long-running request
      mockReader.read.mockImplementation(() => 
        new Promise(() => {})
      );

      const streamPromise = (async () => {
        const chunks = [];
        for await (const chunk of handler.streamResponse(sessionId, message, {
          signal: abortController.signal
        })) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Cancel the request
      abortController.abort();

      await expect(streamPromise).rejects.toThrow('The operation was aborted');
    });

    it('should emit error on invalid JSON', async () => {
      const errorSpy = jest.fn();
      handler.on('error', errorSpy);

      mockReader.read
        .mockResolvedValueOnce({
          value: new TextEncoder().encode('data: invalid-json\n'),
          done: false
        })
        .mockResolvedValueOnce(mockEnd());

      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, message)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        context: 'parse',
        sessionId
      }));
    });
  });

  describe('cancelRequest', () => {
    it('should cancel an active request', async () => {
      const sessionId = 'test-cancel';
      const { AbortController: NacAbortController } = require('node-abort-controller');
      const abortSpy = jest.spyOn(NacAbortController.prototype, 'abort');
      
      // Mock a request that will be cancelled
      mockReader.read.mockImplementation(
        () => new Promise(() => {})
      );

      const streamPromise = (async () => {
        const chunks = [];
        for await (const chunk of handler.streamResponse(sessionId, 'test')) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Cancel the request
      const wasCancelled = handler.cancelRequest(sessionId);
      
      expect(wasCancelled).toBe(true);
      expect(abortSpy).toHaveBeenCalled();
      
      // Clean up
      await expect(streamPromise).rejects.toThrow();
    });

    it('should return false if no active request exists', () => {
      const wasCancelled = handler.cancelRequest('non-existent-session');
      expect(wasCancelled).toBe(false);
    });
  });

  describe('error handling', () => {
    const sessionId = 'test-error'; // Defined once for this block
    const mockErrorHandlingSession = {
      id: sessionId, // Use the block-scoped sessionId
      agentId: 'test-agent-error',
      conversationId: null,
      listeners: new Set()
    };

    beforeEach(() => {
      // Consistently return a valid session for 'test-error'
      sessionManager.getSession.mockImplementation(id => {
        if (id === sessionId) {
          return { ...mockErrorHandlingSession };
        }
        return null; // Or handle other IDs if necessary for other tests
      });
    });
    
    it('should handle session not found', async () => {
      sessionManager.getSession.mockReturnValue(null);
      
      await expect(
        (async () => {
          for await (const _ of handler.streamResponse(sessionId, 'test')) {
            // No-op
          }
        })()
      ).rejects.toThrow('Session not found or expired');
    });

    it('should handle non-OK response', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        json: async () => ({ message: 'Rate limited' })
      };
      
      mockFetch.mockResolvedValueOnce(errorResponse);
      
      await expect(
        (async () => {
          for await (const _ of handler.streamResponse(sessionId, 'test')) {
            // No-op
          }
        })()
      ).rejects.toThrow('HTTP error! status: 429');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      networkError.code = 'ENOTFOUND';
      
      mockFetch.mockRejectedValue(networkError);
      
      const errorSpy = jest.fn();
      handler.on('error', errorSpy);
      
      await expect(
        (async () => {
          for await (const _ of handler.streamResponse(sessionId, 'test')) {
            // No-op
          }
        })()
      ).rejects.toThrow('Network error');
      
      // Should have retried the max number of times
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries (maxRetries = 3)
    });

    // This test was a duplicate or misnamed, content was merged into the one above or handled by other tests.
    // it('should handle network errors', async () => { }); // Intentionally commented out or removed if truly redundant

    it('should handle aborted requests', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      
      mockFetch.mockRejectedValue(abortError);
      
      await expect(
        (async () => {
          for await (const _ of handler.streamResponse(sessionId, 'test')) {
            // No-op
          }
        })()
      ).rejects.toThrow('The user aborted a request.');
    });

    it('should handle invalid response body', async () => {
      const invalidResponse = {
        ok: true,
        body: null // No body
      };
      
      mockFetch.mockResolvedValueOnce(invalidResponse);
      
      await expect(
        (async () => {
          for await (const _ of handler.streamResponse(sessionId, 'test')) {
            // No-op
          }
        })()
      ).rejects.toThrow('Response body is not readable');
    });
  });
  
  describe('session listeners', () => {

    const sessionId = 'test-listeners';
    const testMessage = { content: 'Test message' };
    
    it('should notify session listeners', async () => {
      const mockListener = jest.fn();
      const testSession = {
        id: sessionId,
        agentId: 'test-agent',
        conversationId: null,
        listeners: new Set([mockListener])
      };
      
      sessionManager.getSession.mockReturnValue(testSession);
      
      mockReader.read
        .mockResolvedValueOnce(mockChunk(testMessage))
        .mockResolvedValueOnce(mockEnd());
      
      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, 'test')) {
        chunks.push(chunk);
      }
      
      expect(mockListener).toHaveBeenCalledWith(testMessage);
    });
    
    it('should handle listener errors gracefully', async () => {
      const errorSpy = jest.fn();
      handler.on('error', errorSpy);
      
      const failingListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      const testSession = {
        id: sessionId,
        agentId: 'test-agent',
        conversationId: null,
        listeners: new Set([failingListener])
      };
      
      sessionManager.getSession.mockReturnValue(testSession);
      
      mockReader.read
        .mockResolvedValueOnce(mockChunk(testMessage))
        .mockResolvedValueOnce(mockEnd());
      
      const chunks = [];
      for await (const chunk of handler.streamResponse(sessionId, 'test')) {
        chunks.push(chunk);
      }
      
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(Error),
        context: 'listener',
        sessionId
      }));
    });
  });
  
  describe('destroy', () => {
    it('should clean up resources', async () => {
      // Start a request to make it active
      // Ensure this mock allows the request to proceed enough to be active but not fully resolve or reject immediately in a way that prevents destroy logic.
      mockFetch.mockImplementation(() => new Promise(resolve => {
        // Simulates a fetch call that starts but doesn't complete, allowing it to be in activeRequests
        // We don't resolve or reject here, as the abort in destroy() should handle it.
      }));
      const streamPromise = handler.streamResponse('test-session-destroy', 'message');
      // Don't await it fully, just let it start
      await new Promise(resolve => setTimeout(resolve, 10)); // allow it to be added to activeRequests, give a bit more time

      const { AbortController: NacAbortController } = require('node-abort-controller');
      const abortSpy = jest.spyOn(NacAbortController.prototype, 'abort');
      
      // Add an active request
      mockReader.read.mockImplementation(() => new Promise(() => {}));
      
      // Destroy the handler
      handler.destroy();
      
      // Should have aborted the active request
      expect(abortSpy).toHaveBeenCalled();

      // Prevent UnhandledPromiseRejectionWarning by catching the expected error from the cancelled stream
      await streamPromise.catch(err => {
        if (err.name !== 'AbortError' && !err.message.includes('aborted')) {
          // console.error('Unexpected error in destroy test cleanup:', err);
        }
      });
      
      // Should have removed all listeners
      expect(handler.listenerCount('error')).toBe(0);
      expect(handler.listenerCount('retry')).toBe(0);
    });
  });
});
