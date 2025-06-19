const { jest } = require('@jest/globals');
const { ConversationManager } = require('../../../lib/conversation/ConversationManager.js');
const { ConversationHistory } = require('../../../lib/history/ConversationHistory.js');

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

describe('ConversationManager', () => {
  let sessionManager;
  let conversationManager;
  
  beforeEach(() => {
    jest.useFakeTimers();
    
    sessionManager = new MockSessionManager();
    
    // Create a test session
    sessionManager.addSession('test-session', {
      id: 'test-session',
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      listeners: new Set()
    });
    
    // Create conversation manager with shorter timeouts for testing
    conversationManager = new ConversationManager({
      sessionManager,
      conversationOptions: {
        idleTimeout: 1000, // 1 second for testing
        maxDuration: 5000, // 5 seconds for testing
        maxHistory: 10,
        maxTokens: 1000
      }
    });
    
    // Set a test conversation ID
    conversationManager.conversationId = 'test-conversation';
  });
  
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    conversationManager.destroy();
  });
  
  describe('state management', () => {
    it('should initialize with correct default state', () => {
      const state = conversationManager.getState();
      
      expect(state.state).toBe('active');
      expect(state.conversationId).toBe('test-conversation');
      expect(state.messageCount).toBe(0);
      expect(state.tokenCount).toBe(0);
      expect(state.lastActivity).toBeDefined();
    });
    
    it('should transition to idle after timeout', async () => {
      const stateChangeHandler = jest.fn();
      conversationManager.on('stateChange', stateChangeHandler);
      
      // Fast-forward past idle timeout
      jest.advanceTimersByTime(1500);
      
      // Check state change
      expect(stateChangeHandler).toHaveBeenCalledWith({
        previousState: 'active',
        newState: 'idle',
        conversationId: 'test-conversation',
        timestamp: expect.any(Number)
      });
      
      expect(conversationManager.getState().state).toBe('idle');
    });
    
    it('should reset idle timer on activity', async () => {
      const stateChangeHandler = jest.fn();
      conversationManager.on('stateChange', stateChangeHandler);
      
      // Fast-forward a bit
      jest.advanceTimersByTime(500);
      
      // Add a message (should reset idle timer)
      await conversationManager.addMessage({
        role: 'user',
        content: 'Test message'
      });
      
      // Fast-forward to when idle would have happened without reset
      jest.advanceTimersByTime(600);
      
      // Should not be idle yet
      expect(conversationManager.getState().state).toBe('active');
      
      // Fast-forward to after new idle timeout
      jest.advanceTimersByTime(600);
      
      // Now should be idle
      expect(conversationManager.getState().state).toBe('idle');
    });
    
    it('should complete conversation after max duration', async () => {
      const completeHandler = jest.fn();
      conversationManager.on('completed', completeHandler);
      
      // Fast-forward past max duration
      jest.advanceTimersByTime(6000);
      
      // Check completion
      expect(completeHandler).toHaveBeenCalledWith({
        conversationId: 'test-conversation',
        reason: 'max_duration_reached',
        messageCount: 0,
        tokenCount: 0
      });
      
      expect(conversationManager.getState().state).toBe('completed');
    });
  });
  
  describe('message management', () => {
    it('should add messages to history', async () => {
      const messageAddedHandler = jest.fn();
      conversationManager.on('messageAdded', messageAddedHandler);
      
      // Add a message
      const message = await conversationManager.addMessage({
        role: 'user',
        content: 'Hello, world!'
      });
      
      // Check event
      expect(messageAddedHandler).toHaveBeenCalledWith({
        conversationId: 'test-conversation',
        message: expect.objectContaining({
          role: 'user',
          content: 'Hello, world!',
          id: expect.any(String)
        }),
        tokenCount: expect.any(Number)
      });
      
      // Check history
      const history = conversationManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello, world!'
      });
    });
    
    it('should reactivate from idle on new message', async () => {
      // Go to idle
      jest.advanceTimersByTime(1500);
      expect(conversationManager.getState().state).toBe('idle');
      
      // Add a message
      await conversationManager.addMessage({
        role: 'user',
        content: 'I\'m back!'
      });
      
      // Should be active again
      expect(conversationManager.getState().state).toBe('active');
    });
    
    it('should not allow adding messages to completed conversation', async () => {
      // Complete the conversation
      await conversationManager.complete('test_complete');
      
      // Try to add a message
      await expect(
        conversationManager.addMessage({
          role: 'user',
          content: 'This should fail'
        })
      ).rejects.toThrow('Cannot add message to completed conversation');
    });
  });
  
  describe('summarization', () => {
    it('should trigger summarization when token threshold is reached', async () => {
      // Mock summarize method
      const mockSummarize = jest.spyOn(conversationManager, 'summarize')
        .mockImplementation(async () => ({
          summary: { id: 'summary-1', content: 'Summary' },
          duration: 100,
          tokenCount: 10,
          messageCount: 1
        }));
      
      // Set up options to trigger summarization after 2 messages
      conversationManager.options.maxTokens = 100;
      conversationManager.options.summarizeThreshold = 0.5; // 50% of max tokens
      
      // Add messages that will exceed the threshold
      await conversationManager.addMessage({
        role: 'user',
        content: 'Message 1',
        tokens: 30
      });
      
      // Shouldn't summarize yet
      expect(mockSummarize).not.toHaveBeenCalled();
      
      // Add another message to exceed threshold
      await conversationManager.addMessage({
        role: 'assistant',
        content: 'Response 1',
        tokens: 30
      });
      
      // Should have triggered summarization
      expect(mockSummarize).toHaveBeenCalled();
    });
    
    it('should handle summarization errors', async () => {
      // Mock summarize to throw an error
      const error = new Error('Summarization failed');
      jest.spyOn(conversationManager, 'summarize').mockRejectedValue(error);
      
      // Set up options to trigger summarization
      conversationManager.options.maxTokens = 100;
      conversationManager.options.summarizeThreshold = 0.1; // Low threshold to trigger quickly
      
      const errorHandler = jest.fn();
      conversationManager.on('summarize:error', errorHandler);
      
      // Add a message to trigger summarization
      await conversationManager.addMessage({
        role: 'user',
        content: 'Trigger summarization',
        tokens: 20
      });
      
      // Should have called error handler
      expect(errorHandler).toHaveBeenCalledWith({
        conversationId: 'test-conversation',
        error,
        duration: expect.any(Number)
      });
    });
  });
  
  describe('completion', () => {
    it('should complete conversation and clean up', async () => {
      const completeHandler = jest.fn();
      conversationManager.on('completed', completeHandler);
      
      // Add a message
      await conversationManager.addMessage({
        role: 'user',
        content: 'Hello'
      });
      
      // Complete the conversation
      await conversationManager.complete('test_complete');
      
      // Check completion
      expect(completeHandler).toHaveBeenCalledWith({
        conversationId: 'test-conversation',
        reason: 'test_complete',
        messageCount: 1,
        tokenCount: expect.any(Number)
      });
      
      // Check state
      expect(conversationManager.getState().state).toBe('completed');
      
      // Should not be able to add more messages
      await expect(
        conversationManager.addMessage({
          role: 'user',
          content: 'Too late!'
        })
      ).rejects.toThrow('Cannot add message to completed conversation');
    });
  });
});
