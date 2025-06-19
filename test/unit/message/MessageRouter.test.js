const { jest } = require('@jest/globals');
const { MessageRouter } = require('../../../lib/message/MessageRouter.js');

// Mock SessionManager
class MockSessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  getSession(id) {
    return this.sessions.get(id);
  }
  
  addSession(id, session) {
    this.sessions.set(id, session);
  }
}

describe('MessageRouter', () => {
  let sessionManager;
  let messageRouter;
  let mockProcessMessage;
  
  beforeEach(() => {
    jest.useFakeTimers();
    
    sessionManager = new MockSessionManager();
    mockProcessMessage = jest.fn().mockResolvedValue({ status: 'processed' });
    
    // Create a test session
    sessionManager.addSession('test-session', {
      id: 'test-session',
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      listeners: new Set()
    });
    
    // Create message router with low limits for testing
    messageRouter = new MessageRouter({
      sessionManager,
      maxConcurrent: 2,
      rateLimitWindow: 1000,
      rateLimitMax: 3
    });
    
    // Override the protected _processMessage method for testing
    messageRouter._processMessage = mockProcessMessage;
  });
  
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });
  
  describe('queueMessage', () => {
    it('should process a message immediately when under concurrency limit', async () => {
      const message = { text: 'Test message' };
      const result = await messageRouter.queueMessage('test-session', message);
      
      expect(mockProcessMessage).toHaveBeenCalledTimes(1);
      expect(mockProcessMessage).toHaveBeenCalledWith(
        sessionManager.getSession('test-session'),
        expect.objectContaining({ text: 'Test message' })
      );
      expect(result).toEqual({ status: 'processed' });
    });
    
    it('should queue messages when concurrency limit is reached', async () => {
      // Block processing to test queueing
      let resolveProcessing;
      const processingPromise = new Promise(resolve => {
        resolveProcessing = resolve;
      });
      
      mockProcessMessage.mockImplementationOnce(() => processingPromise);
      
      // First message will be processed immediately
      const message1 = messageRouter.queueMessage('test-session', { text: 'Message 1' });
      
      // Second message will also be processed (concurrency limit is 2)
      const message2 = messageRouter.queueMessage('test-session', { text: 'Message 2' });
      
      // Third message should be queued
      const message3 = messageRouter.queueMessage('test-session', { text: 'Message 3' });
      
      // Check that only 2 messages are being processed
      expect(mockProcessMessage).toHaveBeenCalledTimes(2);
      
      // Resolve the first message
      resolveProcessing({ status: 'processed' });
      await jest.runOnlyPendingTimersAsync();
      
      // Third message should now be processed
      expect(mockProcessMessage).toHaveBeenCalledTimes(3);
      
      // All messages should resolve successfully
      await expect(Promise.all([message1, message2, message3])).resolves.toEqual([
        { status: 'processed' },
        { status: 'processed' },
        { status: 'processed' }
      ]);
    });
    
    it('should respect rate limiting', async () => {
      // Set rate limit to 2 per second
      messageRouter = new MessageRouter({
        sessionManager,
        rateLimitWindow: 1000,
        rateLimitMax: 2
      });
      messageRouter._processMessage = mockProcessMessage;
      
      // First two messages should be processed
      const message1 = messageRouter.queueMessage('test-session', { text: 'Message 1' });
      const message2 = messageRouter.queueMessage('test-session', { text: 'Message 2' });
      
      // Third message should be rate limited
      await expect(
        messageRouter.queueMessage('test-session', { text: 'Message 3' })
      ).rejects.toThrow('Rate limit exceeded');
      
      // Fast-forward time to reset rate limit
      jest.advanceTimersByTime(1100);
      
      // Next message should be processed
      const message4 = messageRouter.queueMessage('test-session', { text: 'Message 4' });
      await expect(message4).resolves.toEqual({ status: 'processed' });
    });
    
    it('should handle message processing errors', async () => {
      const error = new Error('Processing failed');
      mockProcessMessage.mockRejectedValueOnce(error);
      
      await expect(
        messageRouter.queueMessage('test-session', { text: 'Failing message' })
      ).rejects.toThrow('Processing failed');
    });
  });
  
  describe('getQueueStatus', () => {
    it('should return correct queue status', async () => {
      // Block processing to test queue status
      let resolveProcessing;
      mockProcessMessage.mockImplementationOnce(
        () => new Promise(resolve => { resolveProcessing = resolve; })
      );
      
      // Queue 3 messages
      const message1 = messageRouter.queueMessage('test-session', { text: 'Message 1' });
      const message2 = messageRouter.queueMessage('test-session', { text: 'Message 2' });
      const message3 = messageRouter.queueMessage('test-session', { text: 'Message 3' });
      
      // Check status
      const status = messageRouter.getQueueStatus('test-session');
      expect(status).toEqual({
        queued: 1, // One message should be queued (2 active, 1 queued)
        active: 2,
        rateLimited: false,
        rateLimit: {
          current: 2, // Two messages processed
          max: 3,
          resetIn: expect.any(Number)
        },
        maxConcurrent: 2
      });
      
      // Clean up
      resolveProcessing({ status: 'processed' });
      await jest.runAllTimersAsync();
    });
  });
  
  describe('events', () => {
    it('should emit message processing events', async () => {
      const processingHandler = jest.fn();
      const completeHandler = jest.fn();
      const errorHandler = jest.fn();
      
      messageRouter.on('message:processing', processingHandler);
      messageRouter.on('message:complete', completeHandler);
      messageRouter.on('message:error', errorHandler);
      
      const message = { text: 'Test event' };
      await messageRouter.queueMessage('test-session', message);
      
      expect(processingHandler).toHaveBeenCalledWith({
        sessionId: 'test-session',
        message: expect.objectContaining({ text: 'Test event' })
      });
      
      expect(completeHandler).toHaveBeenCalledWith({
        sessionId: 'test-session',
        message: expect.objectContaining({ text: 'Test event' }),
        result: { status: 'processed' }
      });
      
      expect(errorHandler).not.toHaveBeenCalled();
    });
    
    it('should emit error events on processing failure', async () => {
      const error = new Error('Test error');
      mockProcessMessage.mockRejectedValueOnce(error);
      
      const errorHandler = jest.fn();
      messageRouter.on('message:error', errorHandler);
      
      try {
        await messageRouter.queueMessage('test-session', { text: 'Failing message' });
      } catch (err) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalledWith({
        sessionId: 'test-session',
        message: expect.any(Object),
        error
      });
    });
  });
});
