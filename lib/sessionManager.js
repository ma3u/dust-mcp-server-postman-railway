const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const FileUploadHandler = require('./fileUploadHandler');

const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Manages active conversation sessions with Dust agents.
 * Handles session creation, retrieval, and cleanup of expired sessions.
 */
class SessionManager {
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.uploadDir] - Directory for file uploads
   * @param {number} [options.maxFileSize] - Maximum file size in bytes
   */
  constructor({ uploadDir, maxFileSize } = {}) {
    this.sessions = new Map();
    this.fileUploadHandler = new FileUploadHandler({ uploadDir, maxFileSize });
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      CLEANUP_INTERVAL
    );
    process.on('SIGTERM', () => this.destroy());
    process.on('SIGINT', () => this.destroy());
  }

  /**
   * Destroy the session manager and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }

  /**
   * Create a new session
   * @param {string} workspaceId - Workspace ID
   * @param {string} agentId - Agent ID
   * @param {Object} [options] - Session options
   * @returns {Object} - Created session
   */
  createSession(workspaceId, agentId, options = {}) {
    const sessionId = uuidv4();
    const now = Date.now();
    
    const session = {
      id: sessionId,
      workspaceId,
      agentId,
      conversationId: options.conversationId || null,
      lastActivity: now,
      createdAt: now,
      updatedAt: now,
      listeners: new Set(),
      files: [],
      metadata: {
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        ...options.metadata
      },
      data: {}
    };
    
    this.sessions.set(sessionId, session);
    this.log(`Created session ${sessionId}`);
    return session;
  }

  /**
   * Gets a session by ID and updates its last activity time
   * @param {string} sessionId - The session ID
   * @returns {Object|null} The session or null if not found
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session || null;
  }

  /**
   * Updates session properties
   * @param {string} sessionId - The session ID
   * @param {Object} updates - Object with properties to update
   * @returns {boolean} True if session was updated, false if not found
   */
  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Update session properties
    Object.assign(session, updates);
    session.lastActivity = Date.now();
    
    return true;
  }

  /**
   * Deletes a session
   * @param {string} sessionId - The session ID to delete
   * @returns {boolean} True if session was deleted, false if not found
   */
  deleteSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      // Clean up any resources
      if (session.listeners) {
        session.listeners.clear();
      }
      return this.sessions.delete(sessionId);
    }
    return false;
  }

  /**
   * Adds a listener to a session
   * @param {string} sessionId - The session ID
   * @param {string} listenerId - The listener ID
   * @returns {boolean} True if listener was added, false if session not found
   */
  addListener(sessionId, listenerId) {
    const session = this.getSession(sessionId);
    if (session) {
      session.listeners.add(listenerId);
      return true;
    }
    return false;
  }

  /**
   * Removes a listener from a session
   * @param {string} sessionId - The session ID
   * @param {string} listenerId - The listener ID
   * @returns {boolean} True if listener was removed, false if session not found or listener not in session
   */
  removeListener(sessionId, listenerId) {
    const session = this.getSession(sessionId);
    if (session && session.listeners.has(listenerId)) {
      return session.listeners.delete(listenerId);
    }
    return false;
  }

  /**
   * Updates a session's conversation ID
   * @param {string} sessionId - The session ID
   * @param {string} conversationId - The conversation ID
   * @returns {boolean} True if session was updated, false if not found
   */
  setConversationId(sessionId, conversationId) {
    return this.updateSession(sessionId, { conversationId });
  }

  /**
   * Clean up expired sessions and their resources
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      // Skip if session has active listeners
      if (session.listeners.size > 0) {
        continue;
      }

      // Check if session has expired
      if (now - session.lastActivity > CONVERSATION_TTL) {
        this.sessions.delete(sessionId);
        expiredCount++;
        
        // Clean up any files associated with this session
        try {
          await this.cleanupSessionFiles(sessionId);
          this.log(`Cleaned up resources for session ${sessionId}`);
        } catch (err) {
          this.error(`Error cleaning up files for session ${sessionId}:`, err);
        }
      }
    }

    if (expiredCount > 0) {
      this.log(`Cleaned up ${expiredCount} expired sessions`);
    }
    
    return expiredCount;
  }
  
  /**
   * Handle file upload for a session
   * @param {Object} file - File object
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - File metadata
   */
  async handleFileUpload(file, sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    try {
      const fileMetadata = await this.fileUploadHandler.handleUpload(file, sessionId);
      
      // Add file to session
      session.files = session.files || [];
      session.files.push(fileMetadata);
      session.updatedAt = Date.now();
      
      this.log(`File uploaded to session ${sessionId}: ${fileMetadata.originalName}`);
      return fileMetadata;
    } catch (error) {
      this.error(`Error handling file upload for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get files for a session
   * @param {string} sessionId - Session ID
   * @returns {Array<Object>} - Array of file metadata objects
   */
  getSessionFiles(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session.files || [];
  }
  
  /**
   * Clean up files for a session
   * @param {string} sessionId - Session ID
   */
  async cleanupSessionFiles(sessionId) {
    try {
      await this.fileUploadHandler.cleanupSessionFiles(sessionId);
      
      // Clear file references from session
      const session = this.getSession(sessionId);
      if (session) {
        session.files = [];
        session.updatedAt = Date.now();
      }
    } catch (error) {
      this.error(`Error cleaning up files for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Cleans up resources
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }

  log(message) {
    console.log(`[SessionManager] ${message}`);
  }

  error(message, error) {
    console.error(`[SessionManager] ${message}`, error);
  }
}

module.exports = { SessionManager };
