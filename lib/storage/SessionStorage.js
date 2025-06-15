const fs = require('fs').promises;
const path = require('path');
const { fileURLToPath } = require('url'); // May not be needed if not used elsewhere
const { v4: uuidv4 } = require('uuid');

// __filename and __dirname are globally available in CommonJS modules

/**
 * Interface for session storage adapters
 */
class SessionStorage {
  /**
   * Save a session
   * @param {Object} session - Session object to save
   * @returns {Promise<string>} Session ID
   */
  async save(session) {
    throw new Error('Not implemented');
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  async get(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * List all sessions
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array>} Array of session objects
   */
  async list(filter = {}) {
    throw new Error('Not implemented');
  }
}

/**
 * File system based session storage
 */
class FileSystemSessionStorage extends SessionStorage {
  /**
   * @param {Object} options - Storage options
   * @param {string} [options.storagePath] - Path to store session files
   * @param {number} [options.maxSessions=1000] - Maximum number of sessions to keep
   */
  constructor({ storagePath, maxSessions = 1000 } = {}) {
    super();
    this.storagePath = storagePath || path.join(process.cwd(), '.sessions');
    this.maxSessions = maxSessions;
    this.initialized = false;
  }

  /**
   * Initialize storage directory
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      try {
        await fs.mkdir(this.storagePath, { recursive: true });
        this.initialized = true;
      } catch (error) {
        console.error(`[FileSystemSessionStorage] Failed to initialize storage:`, error);
        throw new Error(`Failed to initialize session storage: ${error.message}`);
      }
    }
  }

  /**
   * Get session file path
   * @private
   */
  _getSessionPath(sessionId) {
    return path.join(this.storagePath, `${sessionId}.json`);
  }

  /**
   * Save a session
   * @param {Object} session - Session object to save
   * @returns {Promise<string>} Session ID
   */
  async save(session) {
    await this._ensureInitialized();
    
    const sessionId = session.id || uuidv4();
    const sessionPath = this._getSessionPath(sessionId);
    const sessionData = {
      ...session,
      id: sessionId,
      updatedAt: Date.now(),
      createdAt: session.createdAt || Date.now()
    };

    try {
      await fs.writeFile(
        sessionPath,
        JSON.stringify(sessionData, null, 2),
        'utf8'
      );
      return sessionId;
    } catch (error) {
      console.error(`[FileSystemSessionStorage] Failed to save session ${sessionId}:`, error);
      throw new Error(`Failed to save session: ${error.message}`);
    }
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  async get(sessionId) {
    await this._ensureInitialized();
    const sessionPath = this._getSessionPath(sessionId);

    try {
      const data = await fs.readFile(sessionPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Session not found
      }
      console.error(`[FileSystemSessionStorage] Error reading session ${sessionId}:`, error);
      throw new Error(`Failed to read session: ${error.message}`);
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(sessionId) {
    await this._ensureInitialized();
    const sessionPath = this._getSessionPath(sessionId);

    try {
      await fs.unlink(sessionPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Session not found
      }
      console.error(`[FileSystemSessionStorage] Failed to delete session ${sessionId}:`, error);
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * List all sessions
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array>} Array of session objects
   */
  async list(filter = {}) {
    await this._ensureInitialized();
    
    try {
      const files = await fs.readdir(this.storagePath);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      // Apply limit to prevent memory issues with large numbers of sessions
      const limitedFiles = sessionFiles.slice(0, this.maxSessions);
      
      const sessions = [];
      for (const file of limitedFiles) {
        try {
          const sessionId = path.basename(file, '.json');
          const session = await this.get(sessionId);
          if (session) {
            // Apply filters if provided
            const matchesFilter = Object.entries(filter).every(([key, value]) => {
              return session[key] === value;
            });
            
            if (matchesFilter) {
              sessions.push(session);
            }
          }
        } catch (error) {
          console.error(`[FileSystemSessionStorage] Error reading session file ${file}:`, error);
          // Continue with other files
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('[FileSystemSessionStorage] Error listing sessions:', error);
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of sessions removed
   */
  async cleanupExpiredSessions(maxAge = 30 * 60 * 1000) {
    await this._ensureInitialized();
    const now = Date.now();
    let removedCount = 0;

    try {
      const sessions = await this.list();
      
      for (const session of sessions) {
        if ((now - (session.updatedAt || session.createdAt)) > maxAge) {
          await this.delete(session.id);
          removedCount++;
        }
      }
      
      return removedCount;
    } catch (error) {
      console.error('[FileSystemSessionStorage] Error cleaning up sessions:', error);
      throw new Error(`Failed to clean up sessions: ${error.message}`);
    }
  }
}

module.exports = { SessionStorage, FileSystemSessionStorage };
