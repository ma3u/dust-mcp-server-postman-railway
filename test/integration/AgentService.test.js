const AgentService = require('../../lib/agent/AgentService.js');
const { SessionManager } = require('../../lib/sessionManager.js');
const { ConversationManager } = require('../../lib/conversation/ConversationManager.js');

// Mock fetch
global.fetch = jest.fn();

// Mock SessionManager
class MockSessionManager {
  constructor() {
    this.sessions = new Map();
    this.conversationIds = new Map();
  }
  
  getSession(id) {
    return this.sessions.get(id);
  }
  
  addSession(id, session) {
    this.sessions.set(id, session);
  }
  
  setConversationId(sessionId, conversationId) {
    this.conversationIds.set(sessionId, conversationId);
    const session = this.getSession(sessionId);
    if (session) {
      session.conversationId = conversationId;
    }
  }
  
  getConversationId(sessionId) {
    return this.conversationIds.get(sessionId);
  }
}

describe('AgentService Integration', () => {
  let sessionManager;
  let agentService;
  
  const TEST_SESSION = {
    id: 'test-session',
    workspaceId: 'workspace-1',
    agentId: 'agent-1',
    conversationId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastActivity: Date.now(),
    listeners: new Set(),
    data: {}
  };
  
  const MOCK_API_RESPONSE = {
    messageId: 'msg-123',
    content: 'This is a test response',
    model: 'gpt-4',
    usage: {
      total_tokens: 42
    }
  };
  
  beforeEach(() => {
    jest.useFakeTimers();
    
    // Reset fetch mock
    fetch.mockReset();
    
    // Setup session manager with a test session
    sessionManager = new MockSessionManager();
    sessionManager.addSession(TEST_SESSION.id, { ...TEST_SESSION });
    
    // Setup agent service
    agentService = new AgentService({
      sessionManager,
      apiKey: 'test-api-key',
      apiUrl: 'https://test.dust.tt',
      messageRouter: {
        maxConcurrent: 2,
        rateLimitWindow: 1000,
        rateLimitMax: 5
      },
      conversation: {
        maxHistory: 10,
        maxTokens: 1000,
        idleTimeout: 5000, // 5 seconds for testing
        maxDuration: 30000 // 30 seconds for testing
      }
    });
    
    // Mock fetch response
    fetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    agentService.destroy();
  });
  
  describe('message processing', () => {
    it('should process a message through the agent', async () => {
      // Process a message
      const result = await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'Hello, world!' }
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        messageId: MOCK_API_RESPONSE.messageId,
        conversationId: expect.any(String)
      });
      
      // Check that fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = fetch.mock.calls[0];
      
      expect(url).toContain(`/api/workspaces/${TEST_SESSION.workspaceId}/conversations`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        message: 'Hello, world!',
        agentId: TEST_SESSION.agentId,
        model: 'gpt-4',
        stream: false,
        context: {
          previousMessages: []
        }
      });
      
      // Check that conversation was created in session
      const conversationId = sessionManager.getConversationId(TEST_SESSION.id);
      expect(conversationId).toBeDefined();
    });
    
    it('should handle conversation continuation', async () => {
      // First message
      const firstResult = await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'First message' }
      );
      
      // Reset fetch mock for second call
      fetch.mockClear();
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...MOCK_API_RESPONSE,
          content: 'Second response'
        })
      });
      
      // Second message in same conversation
      const secondResult = await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'Second message' }
      );
      
      // Check that the same conversation was used
      expect(secondResult.conversationId).toBe(firstResult.conversationId);
      
      // Check that fetch was called with conversation ID in URL
      const [url] = fetch.mock.calls[0];
      expect(url).toContain(`/conversations/${firstResult.conversationId}/messages`);
    });
    
    it('should handle API errors gracefully', async () => {
      // Mock API error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: 'Internal server error'
        })
      });
      
      // Process a message that will fail
      await expect(
        agentService.processMessage(
          TEST_SESSION.id,
          { role: 'user', content: 'This will fail' }
        )
      ).rejects.toThrow('API request failed with status 500');
      
      // Check that error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[AgentService] Error in _processMessage:',
        expect.any(Error)
      );
    });
  });
  
  describe('conversation management', () => {
    it('should create a new conversation when none exists', async () => {
      // Process a message
      const result = await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'New conversation' }
      );
      
      // Check that a new conversation was created
      expect(result.conversationId).toBeDefined();
      expect(result.conversationId).not.toBe(TEST_SESSION.conversationId);
      
      // Check that session was updated with conversation ID
      const updatedSession = sessionManager.getSession(TEST_SESSION.id);
      expect(updatedSession.conversationId).toBe(result.conversationId);
    });
    
    it('should use existing conversation when available', async () => {
      // Set up session with existing conversation
      const existingConvId = 'existing-conv-123';
      sessionManager.setConversationId(TEST_SESSION.id, existingConvId);
      
      // Process a message
      const result = await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'Existing conversation' }
      );
      
      // Check that existing conversation was used
      expect(result.conversationId).toBe(existingConvId);
      
      // Check that fetch was called with existing conversation ID
      const [url] = fetch.mock.calls[0];
      expect(url).toContain(`/conversations/${existingConvId}/messages`);
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources on destroy', async () => {
      // Process a message to create a conversation
      await agentService.processMessage(
        TEST_SESSION.id,
        { role: 'user', content: 'Test cleanup' }
      );
      
      // Spy on conversation destroy
      const conversation = agentService.getOrCreateConversation(TEST_SESSION.id);
      const destroySpy = jest.spyOn(conversation, 'destroy');
      
      // Destroy the service
      agentService.destroy();
      
      // Check that conversation was destroyed
      expect(destroySpy).toHaveBeenCalled();
      
      // Check that message router was cleaned up
      expect(agentService.messageRouter).toBeNull();
    });
  });
});
