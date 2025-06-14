import request from 'supertest';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the file system
const fs = {
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('test file content'),
    writeFile: jest.fn().mockResolvedValue(undefined)
  },
  existsSync: jest.fn().mockReturnValue(true)
};

// Mock node-fetch
const fetch = jest.fn();
const mockFormData = {
  append: jest.fn(),
  getHeaders: jest.fn().mockReturnValue({})
};

// Mock the file upload handler
class MockFileUploadHandler {
  async handleUpload() {
    return { id: 'file-123', name: 'test.txt', path: '/path/to/test.txt' };
  }
  async cleanupFile() {}
}

// Mock the session manager
class MockSessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  createSession() {
    const sessionId = 'test-session-123';
    const session = { id: sessionId, files: [], lastActive: Date.now() };
    this.sessions.set(sessionId, session);
    return session;
  }
  
  getSession() {
    return this.sessions.values().next().value || null;
  }
  
  updateSession() {}
  deleteSession() {}
  addListener() {}
  removeListener() {}
  
  // Add destroy method for cleanup
  destroy() {
    this.sessions.clear();
  }
}

// Use the mock SessionManager for testing
const SessionManager = MockSessionManager;

// Mock FormData
global.FormData = jest.fn().mockImplementation(() => mockFormData);

// Mock the modules
jest.unstable_mockModule('fs/promises', () => ({
  default: fs.promises
}));

jest.unstable_mockModule('node-fetch', () => ({
  default: fetch,
  FormData: global.FormData
}));

// Mock the conversation routes module
const mockConversationRoutes = {
  post: jest.fn()
};

// Mock the express Router
jest.mock('express', () => ({
  Router: () => mockConversationRoutes,
  json: () => (req, res, next) => next(),
  urlencoded: () => (req, res, next) => next()
}));

// Mock the conversation routes
import { createConversationRoutes } from '../../routes/conversationRoutes.js';

// Mock the session manager
const mockSessionManager = new MockSessionManager();

// Mock the file upload handler
const mockFileUploadHandler = new MockFileUploadHandler();

describe('Agent Conversation API', () => {
  let app;
  let sessionManager;
  let testSessionId;
  let testConversationId;
    const testWorkspaceId = 'test-workspace';
  const testAgentId = 'test-agent';
  const testUploadDir = join(__dirname, 'test-uploads');
  const testApiKey = 'test-api-key';
  
  // Mock implementation of fetch responses
  const mockFetchResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
  
  // Mock FormData instance
  let formDataInstance;
  
  // Reset mocks before each test
  beforeEach(() => {
    formDataInstance = {
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({})
    };
    
    global.FormData.mockImplementation(() => formDataInstance);
    
    // Reset fetch mock
    fetch.mockReset();
    
    // Default mock implementation
    fetch.mockImplementation((url) => {
      if (url.endsWith('/conversations')) {
        return Promise.resolve(mockFetchResponse({
          conversation: { id: testConversationId, title: 'Test Conversation' },
          message: { id: 'msg-123', content: 'Test response from agent', role: 'assistant' }
        }));
      }
      
      if (url.includes('/conversations/') && url.endsWith('/messages')) {
        return Promise.resolve(mockFetchResponse({
          message: { id: 'msg-456', content: 'Test response from agent', role: 'assistant' }
        }));
      }
      
      return Promise.resolve(mockFetchResponse({}, 404));
    });
  });

  // Setup test server before all tests
  beforeAll(() => {
    // Create a new session manager with test configuration
    sessionManager = new SessionManager({
      uploadDir: testUploadDir,
      maxFileSize: 5 * 1024 * 1024 // 5MB
    });
    
    // Create a test session and conversation
    testSessionId = uuidv4();
    testConversationId = `conv-${uuidv4()}`;
    
    // Initialize session data
    sessionManager.sessions.set(testSessionId, {
      id: testSessionId,
      workspaceId: testWorkspaceId,
      agentId: testAgentId,
      conversationId: testConversationId,
      lastActivity: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      listeners: new Set(),
      files: [],
      metadata: {},
      data: {}
    });

    // Create Express app with conversation routes
    app = express();
    app.use(express.json());
    
    // Setup routes with mock dependencies
    app.use('/api', createConversationRoutes({ 
      sessionManager,
      dustApiKey: testApiKey,
      dustApiBaseUrl: 'https://dust.tt/api'
    }));
  });

  // Cleanup after all tests
  afterAll(() => {
    if (sessionManager) {
      sessionManager.destroy();
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  
  // Clear all mocks between tests
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          workspaceId: testWorkspaceId,
          agentId: testAgentId,
          message: 'Hello, agent!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `https://dust.tt/api/workspaces/${testWorkspaceId}/conversations`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testApiKey}`
          })
        })
      );
    });

    it('should continue an existing conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          workspaceId: testWorkspaceId,
          agentId: testAgentId,
          conversationId: testConversationId,
          message: 'Continue our conversation'
        });

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe(testConversationId);
      expect(response.body.messages).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(
        `https://dust.tt/api/workspaces/${testWorkspaceId}/conversations/${testConversationId}/messages`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testApiKey}`
          })
        })
      );
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          // Missing workspaceId and agentId
          message: 'This should fail'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('workspaceId, agentId');
    });
  });

  describe('File upload integration', () => {
    it('should include file references in conversation context', async () => {
      // Setup test file in session
      const testFileId = 'file-123';
      const testFileName = 'test.txt';
      const testFilePath = join(testUploadDir, testFileName);
      
      // Add file to session
      sessionManager.sessions.get(testSessionId).files.push({
        id: testFileId,
        filename: testFileName,
        path: testFilePath,
        size: 1234,
        mimetype: 'text/plain',
        uploadedAt: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/conversations')
        .send({
          workspaceId: testWorkspaceId,
          agentId: testAgentId,
          sessionId: testSessionId,
          message: 'Check this file',
          fileIds: [testFileId]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(2);
      
      // Verify FormData was used for file upload
      expect(global.FormData).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle Dust API errors', async () => {
      // Mock an error response from Dust API
      fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' })
        })
      );

      const response = await request(app)
        .post('/api/conversations')
        .send({
          workspaceId: testWorkspaceId,
          agentId: testAgentId,
          message: 'This should trigger an error'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid session', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          workspaceId: testWorkspaceId,
          agentId: testAgentId,
          sessionId: 'non-existent-session',
          message: 'This should fail'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid or expired session');
    });
  });
});
