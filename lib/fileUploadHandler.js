import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class FileUploadHandler {
  constructor({ uploadDir = './uploads', maxFileSize = 10 * 1024 * 1024 } = {}) {
    this.uploadDir = uploadDir;
    this.maxFileSize = maxFileSize;
    this.allowedMimeTypes = new Set([
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ]);

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Handle file upload
   * @param {Object} file - File object with buffer, originalname, mimetype, size
   * @param {string} sessionId - Current session ID
   * @returns {Promise<Object>} - File metadata
   */
  async handleUpload(file, sessionId) {
    try {
      // Validate file
      if (!file || !file.buffer || !file.originalname || !file.mimetype) {
        throw new Error('Invalid file object');
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
      }

      // Check MIME type
      if (!this.allowedMimeTypes.has(file.mimetype)) {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const filename = `${uuidv4()}${fileExt}`;
      const filepath = path.join(this.uploadDir, filename);

      // Save file
      await fs.promises.writeFile(filepath, file.buffer);

      // Return file metadata
      return {
        id: uuidv4(),
        originalName: file.originalname,
        filename,
        filepath,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        sessionId
      };
    } catch (error) {
      console.error('[FileUploadHandler] Error handling file upload:', error);
      throw error;
    }
  }

  /**
   * Clean up files for a session
   * @param {string} sessionId - Session ID
   */
  async cleanupSessionFiles(sessionId) {
    try {
      // In a real implementation, you would query your database for files
      // associated with this session and delete them
      console.log(`[FileUploadHandler] Cleaning up files for session ${sessionId}`);
    } catch (error) {
      console.error(`[FileUploadHandler] Error cleaning up files for session ${sessionId}:`, error);
    }
  }
}

export default FileUploadHandler;
