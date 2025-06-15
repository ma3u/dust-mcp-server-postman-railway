const { SessionManager } = require('../../lib/sessionManager.js');

describe('SessionManager', () => {
  // Enable fake timers for all tests in this suite
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clean up any pending timers and restore the original timers
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  let sessionManager;
  const mockSession = {
    id: 'session-123',
    workspaceId: 'workspace-123',
    agentId: 'agent-123',
    conversationId: 'conv-123',
    lastActivity: Date.now(),
    listeners: new Set(),
    data: {}
  };

  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp
    jest.spyOn(Date, 'now').mockImplementation(() => 1600000000000);
    
    // Create a new SessionManager instance before each test
    sessionManager = new SessionManager();
    
    // Add a test session
    sessionManager.sessions.set(mockSession.id, { ...mockSession });
  });

  afterEach(() => {
    // Clean up mocks
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('createSession', () => {
    test('should create a new session with valid parameters', () => {
      const workspaceId = 'new-workspace';
      const agentId = 'new-agent';
      
      const session = sessionManager.createSession(workspaceId, agentId);
      
      expect(session).toHaveProperty('id');
      expect(session.workspaceId).toBe(workspaceId);
      expect(session.agentId).toBe(agentId);
      expect(session.conversationId).toBeNull();
      expect(session.lastActivity).toBe(Date.now());
      expect(session.listeners).toBeInstanceOf(Set);
      expect(session.data).toEqual({});
      
      // Verify the session was added to the sessions map
      expect(sessionManager.sessions.has(session.id)).toBe(true);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const sessionManager = new SessionManager();
      const session = sessionManager.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('should return session and update lastActivity', () => {
      // Mock Date.now() to have consistent timestamps
      const originalDateNow = Date.now;
      let currentTime = 1000;
      global.Date.now = jest.fn(() => currentTime);
      
      try {
        const sessionManager = new SessionManager();
        const mockSession = sessionManager.createSession('test-workspace', 'test-agent');
        const originalLastActivity = mockSession.lastActivity;
        
        // Advance time by 1 second
        currentTime += 1000;
        
        // Get the session which should update lastActivity
        const session = sessionManager.getSession(mockSession.id);
        expect(session).toBeDefined();
        expect(session.id).toBe(mockSession.id);
        
        // Verify lastActivity was updated to the new time
        expect(session.lastActivity).toBe(currentTime);
        
        // Clean up
        sessionManager.destroy();
      } finally {
        // Restore original Date.now
        global.Date.now = originalDateNow;
      }
    });
  });

  describe('updateSession', () => {
    test('should update session data', () => {
      const updates = {
        conversationId: 'new-conv-id',
        data: { key: 'value' }
      };
      
      const result = sessionManager.updateSession(mockSession.id, updates);
      
      expect(result).toBe(true);
      const updatedSession = sessionManager.sessions.get(mockSession.id);
      expect(updatedSession.conversationId).toBe(updates.conversationId);
      expect(updatedSession.data).toEqual(updates.data);
      expect(updatedSession.lastActivity).toBe(Date.now());
    });

    test('should return false for non-existent session', () => {
      const result = sessionManager.updateSession('non-existent-id', { conversationId: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    test('should remove session', () => {
      const result = sessionManager.deleteSession(mockSession.id);
      expect(result).toBe(true);
      expect(sessionManager.sessions.has(mockSession.id)).toBe(false);
    });

    test('should return false for non-existent session', () => {
      const result = sessionManager.deleteSession('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    beforeEach(() => {
      // Set up test sessions with different lastActivity times
      const now = Date.now();
      const oneHourInMs = 60 * 60 * 1000;
      
      sessionManager.sessions.clear();
      
      // Active session (just created)
      sessionManager.sessions.set('session-1', {
        id: 'session-1',
        lastActivity: now - 1000, // 1 second old
        listeners: new Set()
      });
      
      // Expired session (2 hours old)
      sessionManager.sessions.set('session-2', {
        id: 'session-2',
        lastActivity: now - (2 * oneHourInMs),
        listeners: new Set()
      });
      
      // Session with active listeners (shouldn't be cleaned up)
      const sessionWithListeners = {
        id: 'session-3',
        lastActivity: now - (2 * oneHourInMs),
        listeners: new Set(['listener-1'])
      };
      sessionManager.sessions.set('session-3', sessionWithListeners);
    });

    test('should clean up expired sessions without active listeners', () => {
      sessionManager.cleanupExpiredSessions();
      
      // Only session-1 (active) and session-3 (has listeners) should remain
      expect(sessionManager.sessions.size).toBe(2);
      expect(sessionManager.sessions.has('session-1')).toBe(true);
      expect(sessionManager.sessions.has('session-2')).toBe(false);
      expect(sessionManager.sessions.has('session-3')).toBe(true);
    });
  });

  describe('addListener and removeListener', () => {
    test('should add and remove listeners from a session', () => {
      const sessionId = 'test-session';
      const listenerId = 'test-listener';
      
      // Create a test session
      sessionManager.sessions.set(sessionId, {
        id: sessionId,
        lastActivity: Date.now(),
        listeners: new Set()
      });
      
      // Add a listener
      const addResult = sessionManager.addListener(sessionId, listenerId);
      expect(addResult).toBe(true);
      expect(sessionManager.sessions.get(sessionId).listeners.has(listenerId)).toBe(true);
      
      // Remove the listener
      const removeResult = sessionManager.removeListener(sessionId, listenerId);
      expect(removeResult).toBe(true);
      expect(sessionManager.sessions.get(sessionId).listeners.has(listenerId)).toBe(false);
    });

    test('should handle non-existent session for addListener', () => {
      const result = sessionManager.addListener('non-existent-id', 'listener-1');
      expect(result).toBe(false);
    });

    test('should handle non-existent session for removeListener', () => {
      const result = sessionManager.removeListener('non-existent-id', 'listener-1');
      expect(result).toBe(false);
    });
  });
});
