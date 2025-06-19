const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { fileURLToPath } = require('url'); // This might not be needed if not used elsewhere after removing __filename/__dirname logic
const FileUploadHandler = require('./fileUploadHandler.js');
const { WorkspaceValidator } = require('./validation/workspaceValidator.js');
const { FileSystemSessionStorage } = require('./storage/SessionStorage.js');
const { ConversationHistory } = require('./history/ConversationHistory.js');
const fs_sync = require('fs'); // For synchronous logging to avoid Jest race conditions

// __filename and __dirname are globally available in CommonJS modules

// Constants
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_REQUESTS = 10; // Maximum concurrent requests per session
const DEFAULT_SESSION_OPTIONS = {
  storagePath: path.join(process.cwd(), '.sessions'),
  maxHistory: 50,
  maxTokens: 4000
};

/**
 * @typedef {Object} SessionMetadata
 * @property {string} [userAgent] - User agent string from the client
 * @property {string} [ipAddress] - Client IP address
 * @property {string} [referer] - HTTP referer
 * @property {Object} [custom] - Custom metadata
 */

/**
 * @typedef {Object} Session
 * @property {string} id - Unique session ID
 * @property {string} workspaceId - Workspace ID
 * @property {string} agentId - Agent ID
 * @property {string|null} conversationId - Current conversation ID
 * @property {number} lastActivity - Timestamp of last activity
 * @property {number} createdAt - Timestamp when session was created
 * @property {number} updatedAt - Timestamp when session was last updated
 * @property {Set} listeners - Set of active listeners
 * @property {Array} files - Array of associated files
 * @property {SessionMetadata} metadata - Session metadata
 * @property {Object} data - Custom session data
 * @property {number} activeRequests - Number of active requests
 * @property {Array} requestQueue - Queue of pending requests
 */

/**
 * Manages active conversation sessions with Dust agents.
 * Handles session creation, retrieval, and cleanup of expired sessions.
 */
class SessionManager {
  static _listenerLogFilePath = null;

  static setListenerLogPath(filePath) {
    SessionManager._listenerLogFilePath = filePath;
    // Optionally, clear the log file at the start of a test run
    if (filePath) {
      try {
        fs_sync.writeFileSync(filePath, `[${new Date().toISOString()}] Listener log initialized.\n`);
      } catch (err) {
        console.error('[SessionManager] Failed to initialize listener log file:', err);
      }
    }
  }

  _logListenerActivity(message) {
    if (!SessionManager._listenerLogFilePath) {
      return;
    }
    const sigintCount = process.listenerCount('SIGINT');
    const sigtermCount = process.listenerCount('SIGTERM');
    const logEntry = `[${new Date().toISOString()}] SIGINT: ${sigintCount}, SIGTERM: ${sigtermCount} - ${message}\n`;
    try {
      fs_sync.appendFileSync(SessionManager._listenerLogFilePath, logEntry);
    } catch (err) {
      // Fallback to console.error if file logging fails
      console.error(`[SessionManager] FAILED TO WRITE TO LISTENER LOG: ${logEntry.trim()}`, err);
    }
  }
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.uploadDir] - Directory for file uploads
   * @param {number} [options.maxFileSize] - Maximum file size in bytes
   */
  /**
   * @param {Object} options - Session manager options
   * @param {string} [options.uploadDir] - Directory for file uploads
   * @param {number} [options.maxFileSize] - Maximum file size in bytes
   * @param {string} [options.apiKey] - Dust API key for validation
   * @param {string} [options.storagePath] - Path for session storage
   * @param {number} [options.maxHistory] - Maximum conversation history items
   * @param {number} [options.maxTokens] - Maximum tokens in conversation history
   */
  constructor({
    uploadDir,
    maxFileSize,
    apiKey = process.env.DUST_API_KEY,
    ...options
  } = {}) {
    console.error(`[SessionManager CONSTRUCTOR START] Initial SIGINT: ${process.listenerCount('SIGINT')}, SIGTERM: ${process.listenerCount('SIGTERM')}`);
    this.sessions = new Map();
    this.fileUploadHandler = new FileUploadHandler({ uploadDir, maxFileSize });
    
    // Initialize session storage
    this.storage = new FileSystemSessionStorage({
      storagePath: options.storagePath || DEFAULT_SESSION_OPTIONS.storagePath
    });
    
    // Initialize conversation history
    this.conversationHistory = new ConversationHistory({
      maxHistory: options.maxHistory || DEFAULT_SESSION_OPTIONS.maxHistory,
      maxTokens: options.maxTokens || DEFAULT_SESSION_OPTIONS.maxTokens
    });
    
    // Initialize workspace validator if API key is provided
    if (apiKey) {
      this.validator = new WorkspaceValidator({ apiKey });
    }
    
    // Set up cleanup interval
    if (process.env.JEST_WORKER_ID === undefined) {
      this.cleanupInterval = setInterval(
        () => this.cleanupExpiredSessions(),
        CLEANUP_INTERVAL
      );
    } else {
      console.error('[SessionManager CONSTRUCTOR] Jest environment detected, skipping setInterval for session cleanup.');
      this.cleanupInterval = null;
    }
    
    // Handle process termination
    console.error('[SessionManager CONSTRUCTOR] Diagnosing _gracefulShutdown:');
    console.error(`[SessionManager CONSTRUCTOR] typeof this._gracefulShutdown: ${typeof this._gracefulShutdown}`);
    console.error(`[SessionManager CONSTRUCTOR] this.hasOwnProperty('_gracefulShutdown'): ${this.hasOwnProperty('_gracefulShutdown')}`);
    console.error(`[SessionManager CONSTRUCTOR] Object.getPrototypeOf(this).hasOwnProperty('_gracefulShutdown'): ${Object.getPrototypeOf(this).hasOwnProperty('_gracefulShutdown')}`);
    // console.error('[SessionManager CONSTRUCTOR] this object:', this); // Potentially very verbose
    this._gracefulShutdownSIGTERM = this._gracefulShutdown.bind(this, 'SIGTERM');
    console.error(`[SessionManager CONSTRUCTOR] Adding SIGTERM listener. Current count: ${process.listenerCount('SIGTERM')}`);
    this._logListenerActivity('Before adding SIGTERM listener');
    process.on('SIGTERM', this._gracefulShutdownSIGTERM);
    console.error(`[SessionManager CONSTRUCTOR] Added SIGTERM listener. New count: ${process.listenerCount('SIGTERM')}`);
    this._logListenerActivity('After adding SIGTERM listener');

    this._gracefulShutdownSIGINT = this._gracefulShutdown.bind(this, 'SIGINT');
    console.error(`[SessionManager CONSTRUCTOR] Adding SIGINT listener. Current count: ${process.listenerCount('SIGINT')}`);
    this._logListenerActivity('Before adding SIGINT listener');
    process.on('SIGINT', this._gracefulShutdownSIGINT);
    console.error(`[SessionManager CONSTRUCTOR] Added SIGINT listener. New count: ${process.listenerCount('SIGINT')}`);
    this._logListenerActivity('After adding SIGINT listener');
    
    // Load existing sessions from storage
    this.initializationPromise = this._initializeFromStorage();
    this.initializationPromise.catch(err => {
      console.error('[SessionManager] Failed to initialize from storage:', err);
    });
  }

  /**
   * Initialize sessions from storage
   * @private
   */
  async _initializeFromStorage() {
    console.error('[SessionManager DEBUG] _initializeFromStorage: Entered');
    try {
      const sessions = await this.storage.list();
      for (const session of sessions) {
        this.sessions.set(session.id, session);
      }
      console.error(`[SessionManager] Initialized ${sessions.length} sessions from storage`);
    } catch (error) {
      console.error('[SessionManager] Error initializing from storage:', error);
      throw error;
    }
  }

  /**
   * Save session to persistent storage
   * @param {string} sessionId - Session ID to save
   * @private
   */
  async _persistSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    try {
      await this.storage.save(session);
    } catch (error) {
      console.error(`[SessionManager] Failed to persist session ${sessionId}:`, error);
      throw error;
    }
  }

  async _gracefulShutdown(signal) {
    console.error(`[SessionManager] Received ${signal}. Attempting to save all sessions before exiting...`);
    const savePromises = [];
    // Create a copy of session IDs to iterate over, as sessions might be modified
    const sessionIds = Array.from(this.sessions.keys());

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId); 
      if (session) {
        console.error(`[SessionManager] Queuing session ${sessionId} for persistence during ${signal} shutdown.`);
        // Use a try-catch within the map if individual persistence errors shouldn't stop others
        savePromises.push(this._persistSession(sessionId).catch(err => {
          console.error(`[SessionManager] Error persisting session ${sessionId} during ${signal} shutdown:`, err);
          // Optionally, rethrow or handle as needed, but for shutdown, often best to log and continue
        }));
      }
    }
    
    try {
      await Promise.all(savePromises);
      console.error(`[SessionManager] All active sessions processed for persistence during ${signal} shutdown.`);
    } catch (error) {
      // This catch might be redundant if individual errors are caught above, 
      // but good for unforeseen issues with Promise.all itself.
      console.error(`[SessionManager] Error during bulk session persistence on ${signal} shutdown:`, error);
    }

    console.error(`[SessionManager] Graceful shutdown for ${signal} complete.`);
    // In a real application, you might want to ensure the process exits here if it's a critical signal.
    // For example: if (signal === 'SIGINT' || signal === 'SIGTERM') process.exit();
    // However, calling process.exit() directly can interfere with Jest's test runner.
    // So, for now, we'll rely on the signal to terminate the process naturally if not in Jest.
  }

  /**
   * Create a new session with validation
   * @param {string} workspaceId - Workspace ID // Added this missing JSDoc line for clarity
   * @param {string} agentId - Agent ID
   * @param {Object} [options] - Session options
   * @param {string} [options.conversationId] - Initial conversation ID
   * @param {Object} [options.metadata] - Session metadata
   * @param {string} [options.metadata.userAgent] - User agent string
   * @param {string} [options.metadata.ipAddress] - Client IP address
   * @param {Object} [options.data] - Initial session data
   * @param {boolean} [options.validate=true] - Whether to validate workspace/agent
   * @returns {Promise<Session>} The created session
   */
  async createSession(workspaceId, agentId, options = {}) {
    const sessionId = uuidv4();
    const now = Date.now();
    
    if (!workspaceId || !agentId) {
      console.error('[SessionManager] createSession error: Workspace ID and Agent ID are required');
      throw new Error('Workspace ID and Agent ID are required');
    }
    
    // Validate workspace and agent if validator is available and validation is not explicitly skipped
    if (options.validate !== false && this.validator) {
      try {
        const workspaceValid = await this.validator.validateWorkspace(workspaceId);
        if (!workspaceValid.valid) {
          console.error(`[SessionManager] createSession error: Invalid workspace ${workspaceId}: ${workspaceValid.error}`);
          throw new Error(`Invalid workspace: ${workspaceValid.error || 'Unknown error'}`);
        }
        
        const agentValid = await this.validator.validateAgent(workspaceId, agentId);
        if (!agentValid.valid) {
          console.error(`[SessionManager] createSession error: Invalid agent ${agentId} for workspace ${workspaceId}: ${agentValid.error}`);
          throw new Error(`Invalid agent: ${agentValid.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`[SessionManager] createSession validation failed for workspace ${workspaceId}, agent ${agentId}:`, error.message);
        throw new Error(`Validation failed: ${error.message}`);
      }
    }

    const session = {
      id: sessionId,
      workspaceId,
      agentId,
      conversationId: options.conversationId || null, // Ensure single conversationId
      lastActivity: now,
      createdAt: now,
      updatedAt: now,
      listeners: new Set(), // For specific event listeners on this session
      files: [], // Store file metadata associated with the session
      metadata: {
        userAgent: options.metadata?.userAgent,
        ipAddress: options.metadata?.ipAddress,
        ...options.metadata
      },
      data: { ...options.data }, // Initial session data
      activeRequests: 0,
      requestQueue: [] 
    };
    
    this.sessions.set(sessionId, session);
    try {
      await this._persistSession(sessionId);
    } catch (persistError) {
        console.error(`[SessionManager] createSession: Failed to persist session ${sessionId} initially:`, persistError);
    }
    console.error(`[SessionManager] Created session ${sessionId} for workspace ${workspaceId}, agent ${agentId}`);
    return session;
  }

  /**
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
  async updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Update session properties
    Object.assign(session, updates);
    session.lastActivity = Date.now();
    await this._persistSession(sessionId);
    return true;
  }

  /**
   * Deletes a session
   * @param {string} sessionId - The session ID to delete
   * @returns {boolean} True if session was deleted, false if not found
   */
  async deleteSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      // Clean up any resources
      if (session.listeners) {
        session.listeners.clear();
      }
      await this.storage.delete(sessionId);
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
  async updateConversationId(sessionId, conversationId) {
    const session = this.getSession(sessionId);
    if (session) {
      session.conversationId = conversationId;
      session.lastActivity = Date.now();
      await this._persistSession(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<{inMemory: number, storage: number}>} Cleanup results
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    // Find expired in-memory sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      // Skip sessions with active listeners or recent activity
      if (session.listeners.size === 0 && now - session.lastActivity > CONVERSATION_TTL) {
        expiredSessions.push(sessionId);
      }
    }
    
    // Remove expired sessions from memory and storage
    const cleanupPromises = expiredSessions.map(async (sessionId) => {
      try {
        this.sessions.delete(sessionId); // Remove from memory
        await this.storage.delete(sessionId); // Remove from storage
        return true;
      } catch (err) {
        console.error(`[SessionManager] Error removing session ${sessionId} during cleanup:`, err);
        return false;
      }
    });
    
    // Clean up storage (in case of stale sessions)
    const storageCleanup = this.storage.cleanupExpiredSessions(CONVERSATION_TTL)
      .catch(err => {
        console.error('[SessionManager] Error cleaning up storage:', err);
        return 0;
      });
    
    // Wait for all cleanups to complete
    const inMemoryRemovalResults = await Promise.all(cleanupPromises);
    const successfullyRemovedInMemory = inMemoryRemovalResults.filter(r => r).length;

    const [removedCountFromStorageCleanup] = await Promise.all([
      storageCleanup,
      ...cleanupPromises
    ]);
    
    // Log results
    if (successfullyRemovedInMemory > 0 || removedCountFromStorageCleanup > 0) {
      console.error(
        `[SessionManager] Cleaned up ${successfullyRemovedInMemory} sessions (in-memory and storage) via direct TTL check, ` +
        `and ${removedCountFromStorageCleanup} sessions via storage-level TTL cleanup.`
      );
    }
    
    return {
      inMemoryAndStorageDirect: successfullyRemovedInMemory,
      storageViaFallback: removedCountFromStorageCleanup || 0
    };
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
      await this._persistSession(session.id);
      console.error(`[SessionManager] File uploaded to session ${sessionId}: ${fileMetadata.originalName}`);
      return fileMetadata;
    } catch (error) {
      console.error(`[SessionManager] Error handling file upload for session ${sessionId}:`, error);
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
  async destroy() {
    this._logListenerActivity('destroy() method ENTERED.');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this._logListenerActivity('Cleanup interval cleared.');
    }

    if (typeof this._gracefulShutdownSIGTERM === 'function') {
      process.removeListener('SIGTERM', this._gracefulShutdownSIGTERM);
      this._gracefulShutdownSIGTERM = null;
      this._logListenerActivity('SIGTERM listener removed.');
    } else {
      this._logListenerActivity('SIGTERM listener (_gracefulShutdownSIGTERM) was not set or not a function, no removal needed.');
    }

    if (typeof this._gracefulShutdownSIGINT === 'function') {
      process.removeListener('SIGINT', this._gracefulShutdownSIGINT);
      this._gracefulShutdownSIGINT = null;
      this._logListenerActivity('SIGINT listener removed.');
    } else {
      this._logListenerActivity('SIGINT listener (_gracefulShutdownSIGINT) was not set or not a function, no removal needed.');
    }
    
    this.sessions.clear();
    this._logListenerActivity('Sessions cleared.');

    console.error('[SessionManager] Destroyed.'); // A final confirmation message to stderr
    this._logListenerActivity('destroy() method COMPLETED.');
    return Promise.resolve();
  }

  log(message) {
    console.log(`[SessionManager] ${message}`);
  }

  error(message, error) {
    console.error(`[SessionManager] ${message}`, error);
  }
}

module.exports = { SessionManager };
