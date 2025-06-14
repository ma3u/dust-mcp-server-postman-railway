const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { SessionManager } = require('../lib/sessionManager');

const __filename = module.filename;
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only text, PDF, Word, Excel, and JSON files are allowed.'), false);
    }
  }
});

/**
 * File upload routes
 * @param {Object} options - Options
 * @param {SessionManager} options.sessionManager - Session manager instance
 * @returns {express.Router} Express router
 */
function createFileRoutes({ sessionManager }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/sessions/{sessionId}/files:
   *   post:
   *     summary: Upload files to a session
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               files:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *     responses:
   *       200:
   *         description: Files uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 files:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/FileMetadata'
   *       400:
   *         description: Invalid request or no files provided
   *       404:
   *         description: Session not found
   *       413:
   *         description: File too large
   *       500:
   *         description: Internal server error
   */
  router.post('/sessions/:sessionId/files', upload.array('files'), async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No files were uploaded' 
        });
      }

      // Process each uploaded file
      const uploadPromises = req.files.map(file => 
        sessionManager.handleFileUpload(file, sessionId)
      );

      const uploadedFiles = await Promise.all(uploadPromises);
      
      res.status(200).json({
        success: true,
        files: uploadedFiles
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/sessions/{sessionId}/files:
   *   get:
   *     summary: Get files for a session
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID
   *     responses:
   *       200:
   *         description: List of files
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 files:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/FileMetadata'
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error
   */
  router.get('/sessions/:sessionId/files', async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const files = sessionManager.getSessionFiles(sessionId);
      
      res.status(200).json({
        success: true,
        files
      });
    } catch (error) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }
      next(error);
    }
  });

  // Error handling middleware
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(413).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      // An unknown error occurred
      console.error('File upload error:', err);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while processing your request'
      });
    }
    next();
  });

  return router;
}

module.exports = {
  createFileRoutes
};
