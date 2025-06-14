const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { SessionManager } = require('../../lib/sessionManager');
const { createFileRoutes } = require('../../routes/fileRoutes');

const __filename = module.filename;
const __dirname = path.dirname(__filename);

describe('File Upload API', () => {
  let app;
  let sessionManager;
  let testSessionId;
  const testUploadDir = path.join(__dirname, '../../test-uploads');

  beforeAll(() => {
    // Create test upload directory
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }

    // Initialize session manager with test upload directory
    sessionManager = new SessionManager({
      uploadDir: testUploadDir,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    });

    // Create test session
    const session = sessionManager.createSession('test-workspace', 'test-agent');
    testSessionId = session.id;

    // Create Express app
    app = express();
    app.use(express.json());
    
    // Add file upload routes
    const fileRouter = createFileRoutes({ sessionManager });
    app.use('/api', fileRouter);
  });

  afterAll(async () => {
    // Clean up session manager
    if (sessionManager) {
      sessionManager.destroy();
    }
    
    // Clean up test upload directory
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/sessions/:sessionId/files', () => {
    it('should upload a text file', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/files`)
        .attach('files', Buffer.from('test file content'), 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBe(1);
      expect(response.body.files[0].originalName).toBe('test.txt');
      expect(response.body.files[0].mimeType).toBe('text/plain');
      
      // Verify file exists
      const filePath = path.join(testUploadDir, response.body.files[0].filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should return 500 for invalid file type', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/files`)
        .attach('files', Buffer.from('test'), 'test.exe');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for no files', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/files`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/sessions/:sessionId/files', () => {
    it('should return list of uploaded files', async () => {
      // First upload a file
      await request(app)
        .post(`/api/sessions/${testSessionId}/files`)
        .attach('files', Buffer.from('test file content'), 'test.txt');

      const response = await request(app)
        .get(`/api/sessions/${testSessionId}/files`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBeGreaterThan(0);
      expect(response.body.files[0]).toHaveProperty('id');
      expect(response.body.files[0]).toHaveProperty('originalName');
      expect(response.body.files[0]).toHaveProperty('filename');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session/files');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
