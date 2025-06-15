const { v4: uuidv4 } = require('uuid');

/**
 * Represents a single message in the conversation history
 * @typedef {Object} ConversationMessage
 * @property {string} id - Unique message ID
 * @property {'user'|'agent'|'system'} role - Message role
 * @property {string} content - Message content
 * @property {Object} [metadata] - Additional metadata
 * @property {number} timestamp - Message timestamp
 */

/**
 * Manages conversation history for chat sessions
 */
class ConversationHistory {
  /**
   * @param {Object} options - Options
   * @param {number} [options.maxHistory=50] - Maximum number of messages to keep in history
   * @param {number} [options.maxTokens=4000] - Maximum tokens to keep in history
   */
  constructor({ maxHistory = 50, maxTokens = 4000 } = {}) {
    this.maxHistory = maxHistory;
    this.maxTokens = maxTokens;
    this.histories = new Map(); // sessionId -> {messages: Array, tokenCount: number}
  }

  /**
   * Add a message to the conversation history
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to add
   * @param {'user'|'agent'|'system'} message.role - Message role
   * @param {string} message.content - Message content
   * @param {Object} [message.metadata] - Additional metadata
   * @param {number} [message.timestamp=Date.now()] - Message timestamp
   * @returns {string} Message ID
   */
  addMessage(sessionId, { role, content, metadata = {}, timestamp = Date.now() }) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    if (!['user', 'agent', 'system'].includes(role)) {
      throw new Error('Invalid message role');
    }

    // Initialize history for this session if it doesn't exist
    if (!this.histories.has(sessionId)) {
      this.histories.set(sessionId, {
        messages: [],
        tokenCount: 0
      });
    }

    const history = this.histories.get(sessionId);
    const messageId = uuidv4();
    const message = {
      id: messageId,
      role,
      content,
      metadata,
      timestamp
    };

    // Add message to history
    history.messages.push(message);
    
    // Update token count (approximate)
    history.tokenCount += this._estimateTokens(content);

    // Trim history if needed
    this._trimHistory(sessionId);

    return messageId;
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session ID
   * @param {Object} [options] - Options
   * @param {number} [options.limit] - Maximum number of messages to return
   * @param {number} [options.before] - Only return messages before this timestamp
   * @returns {Array<ConversationMessage>} Array of messages
   */
  getHistory(sessionId, { limit, before } = {}) {
    if (!this.histories.has(sessionId)) {
      return [];
    }

    let messages = [...this.histories.get(sessionId).messages];
    
    // Apply filters
    if (before) {
      messages = messages.filter(msg => msg.timestamp < before);
    }
    
    if (limit) {
      messages = messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * Clear conversation history for a session
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if history was cleared, false if not found
   */
  clearHistory(sessionId) {
    if (this.histories.has(sessionId)) {
      this.histories.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get a summary of the conversation
   * @param {string} sessionId - Session ID
   * @param {Object} [options] - Options
   * @param {number} [options.maxLength=500] - Maximum length of the summary
   * @returns {string} Conversation summary
   */
  getSummary(sessionId, { maxLength = 500 } = {}) {
    const messages = this.getHistory(sessionId);
    if (messages.length === 0) {
      return '';
    }

    // Simple implementation: join recent messages
    let summary = messages
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    // Truncate if needed
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  /**
   * Get token count for a session's history
   * @param {string} sessionId - Session ID
   * @returns {number} Approximate token count
   */
  getTokenCount(sessionId) {
    return this.histories.get(sessionId)?.tokenCount || 0;
  }

  /**
   * Estimate tokens in a string (approximate)
   * @private
   */
  _estimateTokens(text) {
    // Rough estimate: 1 token ~= 4 chars in English
    return Math.ceil((text || '').length / 4);
  }

  /**
   * Trim history to stay within limits
   * @private
   */
  _trimHistory(sessionId) {
    const history = this.histories.get(sessionId);
    if (!history) return;

    // Trim by message count
    while (history.messages.length > this.maxHistory) {
      const removed = history.messages.shift();
      history.tokenCount -= this._estimateTokens(removed.content);
    }

    // Trim by token count (approximate)
    while (history.tokenCount > this.maxTokens && history.messages.length > 1) {
      const removed = history.messages.shift();
      history.tokenCount -= this._estimateTokens(removed.content);
    }

    // Ensure token count is not negative
    history.tokenCount = Math.max(0, history.tokenCount);
  }
}

module.exports = { ConversationHistory };
