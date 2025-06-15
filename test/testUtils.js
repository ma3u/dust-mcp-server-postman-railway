/**
 * Test utilities for the Dust MCP Server
 */

/**
 * Creates a mock session object for testing
 * @param {Object} overrides - Properties to override in the mock session
 * @returns {Object} A mock session object
 */
function createMockSession(overrides = {}) {
  const defaultSession = {
    id: 'test-session-' + Math.random().toString(36).substr(2, 9),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    conversationId: null,
    files: [],
    listeners: new Set(),
    addListener: jest.fn(function(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }),
    removeListener: jest.fn(function(listener) {
      this.listeners.delete(listener);
    }),
    notifyListeners: jest.fn(function(event, data) {
      this.listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (error) {
          console.error('Error in session listener:', error);
        }
      });
    }),
    destroy: jest.fn(function() {
      this.status = 'destroyed';
      this.listeners.clear();
    }),
    ...overrides
  };

  return defaultSession;
}

/**
 * Creates a mock session manager for testing
 * @param {Object} options - Configuration options
 * @param {boolean} options.throwOnGet - Whether to throw when getting a session
 * @param {Object} options.session - Session to return (defaults to a new mock session)
 * @returns {Object} A mock session manager
 */
function createMockSessionManager(options = {}) {
  const {
    throwOnGet = false,
    session = createMockSession(),
    throwOnCreate = false,
    throwOnUpdate = false,
  } = options;

  const sessions = new Map();
  if (session) {
    sessions.set(session.id, session);
  }

  return {
    getSession: jest.fn((sessionId) => {
      if (throwOnGet) {
        throw new Error('Session not found');
      }
      return Promise.resolve(sessions.get(sessionId) || null);
    }),
    createSession: jest.fn(() => {
      if (throwOnCreate) {
        throw new Error('Failed to create session');
      }
      const newSession = createMockSession();
      sessions.set(newSession.id, newSession);
      return Promise.resolve(newSession);
    }),
    updateSession: jest.fn((sessionId, updates) => {
      if (throwOnUpdate) {
        throw new Error('Failed to update session');
      }
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      Object.assign(session, updates);
      return Promise.resolve(session);
    }),
    destroySession: jest.fn((sessionId) => {
      sessions.delete(sessionId);
      return Promise.resolve();
    }),
    cleanupExpiredSessions: jest.fn(() => Promise.resolve()),
  };
}

/**
 * Creates a mock response object for testing
 * @returns {Object} A mock response object with common methods
 */
function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.write = jest.fn().mockReturnValue(true);
  res.end = jest.fn().mockImplementation(function() {
    this.finished = true;
    return this;
  });
  res.on = jest.fn().mockImplementation(function(event, listener) {
    this.listeners = this.listeners || {};
    this.listeners[event] = listener;
    return this;
  });
  res.emit = jest.fn().mockImplementation(function(event, ...args) {
    if (this.listeners && this.listeners[event]) {
      return this.listeners[event](...args);
    }
    return false;
  });
  res.finished = false;
  return res;
}

/**
 * Creates a mock request object for testing
 * @param {Object} options - Request options
 * @returns {Object} A mock request object
 */
function createMockRequest(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    session: options.session || null,
    sessionId: options.sessionId || null,
    on: jest.fn().mockImplementation(function(event, listener) {
      this.listeners = this.listeners || {};
      this.listeners[event] = listener;
      return this;
    }),
    emit: jest.fn().mockImplementation(function(event, ...args) {
      if (this.listeners && this.listeners[event]) {
        return this.listeners[event](...args);
      }
      return false;
    }),
    ...options,
  };
}

/**
 * Helper to wait for a promise to be resolved or rejected
 * @param {Function} fn - Function that returns a promise
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} A promise that resolves when the original promise resolves or rejects
 */
function waitFor(fn, timeout = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      try {
        const result = fn();
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timed out after ${timeout}ms`));
        return;
      }
      
      setTimeout(check, 10);
    }
    
    check();
  });
}

/**
 * Helper to wait for a specific number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} A promise that resolves after the specified time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createMockSession,
  createMockSessionManager,
  createMockRequest,
  createMockResponse,
  waitFor,
  delay,
};
