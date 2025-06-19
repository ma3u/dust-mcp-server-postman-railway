const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { ConversationHistory } = require('../history/ConversationHistory.js');

// Conversation states
const CONVERSATION_STATES = {
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  WAITING_FOR_RESPONSE: 'waiting_for_response',
  IDLE: 'idle',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Default conversation options
const DEFAULT_OPTIONS = {
  maxHistory: 50,
  maxTokens: 4000,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  maxDuration: 60 * 60 * 1000, // 1 hour
  summarizeThreshold: 0.75, // 75% of max tokens
  summaryTokenRatio: 0.5, // Target 50% reduction in tokens when summarizing
};

/**
 * Manages conversation state, context, and summarization for a single conversation.
 */
class ConversationManager extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {SessionManager} options.sessionManager - Session manager instance
   * @param {Object} [options.conversationOptions] - Conversation-specific options
   * @param {number} [options.conversationOptions.maxHistory] - Max history items
   * @param {number} [options.conversationOptions.maxTokens] - Max tokens in history
   * @param {number} [options.conversationOptions.idleTimeout] - Time before idle (ms)
   * @param {number} [options.conversationOptions.maxDuration] - Max conversation duration (ms)
   * @param {number} [options.conversationOptions.summarizeThreshold] - Token threshold for summarization (0-1)
   */
  constructor({ sessionManager, conversationOptions = {} } = {}) {
    super();
    
    if (!sessionManager) {
      throw new Error('SessionManager is required');
    }
    
    this.sessionManager = sessionManager;
    this.options = { ...DEFAULT_OPTIONS, ...conversationOptions };
    
    // Conversation state
    this.state = CONVERSATION_STATES.INITIALIZING;
    this.conversationId = null;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.lastActivity = this.createdAt;
    
    // Initialize conversation history
    this.history = new ConversationHistory({
      maxHistory: this.options.maxHistory,
      maxTokens: this.options.maxTokens
    });
    
    // Timeout handles
    this.idleTimeout = null;
    this.maxDurationTimeout = null;
    
    // Bind methods
    this.setState = this.setState.bind(this);
    this.resetTimeouts = this.resetTimeouts.bind(this);
    this.handleIdleTimeout = this.handleIdleTimeout.bind(this);
    this.handleMaxDuration = this.handleMaxDuration.bind(this);
    
    // Set up timeouts
    this.resetTimeouts();
    this.setState(CONVERSATION_STATES.ACTIVE);
  }
  
  /**
   * Set the conversation state and emit events
   * @private
   * @param {string} newState - New state
   * @param {Object} [data] - Additional data to include in event
   */
  setState(newState, data = {}) {
    if (!Object.values(CONVERSATION_STATES).includes(newState)) {
      throw new Error(`Invalid conversation state: ${newState}`);
    }
    
    const previousState = this.state;
    this.state = newState;
    this.updatedAt = Date.now();
    
    if (newState === CONVERSATION_STATES.ACTIVE) {
      this.lastActivity = this.updatedAt;
      this.resetTimeouts();
    }
    
    // Emit state change event
    this.emit('stateChange', {
      previousState,
      newState,
      conversationId: this.conversationId,
      timestamp: this.updatedAt,
      ...data
    });
    
    // Emit specific state events
    if (newState === CONVERSATION_STATES.IDLE) {
      this.emit('idle', { conversationId: this.conversationId });
    } else if (newState === CONVERSATION_STATES.COMPLETED) {
      this.emit('completed', { conversationId: this.conversationId });
    } else if (newState === CONVERSATION_STATES.ERROR) {
      this.emit('error', { 
        conversationId: this.conversationId,
        error: data.error 
      });
    }
  }
  
  /**
   * Reset conversation timeouts
   * @private
   */
  resetTimeouts() {
    // Clear existing timeouts
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    if (this.maxDurationTimeout) clearTimeout(this.maxDurationTimeout);
    
    // Set new timeouts if conversation is active
    if (this.state === CONVERSATION_STATES.ACTIVE) {
      this.idleTimeout = setTimeout(
        this.handleIdleTimeout, 
        this.options.idleTimeout
      );
      
      const timeRemaining = (this.createdAt + this.options.maxDuration) - Date.now();
      if (timeRemaining > 0) {
        this.maxDurationTimeout = setTimeout(
          this.handleMaxDuration,
          timeRemaining
        );
      }
    }
  }
  
  /**
   * Handle idle timeout
   * @private
   */
  handleIdleTimeout() {
    this.setState(CONVERSATION_STATES.IDLE);
  }
  
  /**
   * Handle max duration timeout
   * @private
   */
  handleMaxDuration() {
    this.complete('max_duration_reached');
  }
  
  /**
   * Add a message to the conversation
   * @param {Object} message - Message to add
   * @param {string} message.role - Message role (user/assistant/system)
   * @param {string} message.content - Message content
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<Object>} Added message with ID and timestamp
   */
  async addMessage(message, metadata = {}) {
    if (this.state === CONVERSATION_STATES.COMPLETED) {
      throw new Error('Cannot add message to completed conversation');
    }
    
    if (this.state === CONVERSATION_STATES.ERROR) {
      throw new Error('Cannot add message to conversation in error state');
    }
    
    // Ensure message has required fields
    const messageWithId = {
      id: message.id || `msg_${uuidv4()}`,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || Date.now(),
      ...metadata
    };
    
    try {
      // Add to history
      await this.history.addMessage(messageWithId);
      
      // Update state if needed
      if (this.state === CONVERSATION_STATES.IDLE) {
        this.setState(CONVERSATION_STATES.ACTIVE);
      } else if (this.state === CONVERSATION_STATES.ACTIVE) {
        this.resetTimeouts();
      }
      
      // Check if we need to summarize
      await this.checkAndSummarize();
      
      // Emit event
      this.emit('messageAdded', {
        conversationId: this.conversationId,
        message: messageWithId,
        tokenCount: this.history.tokenCount
      });
      
      return messageWithId;
    } catch (error) {
      this.setState(CONVERSATION_STATES.ERROR, { error });
      throw error;
    }
  }
  
  /**
   * Check if conversation needs summarization and perform if needed
   * @private
   * @returns {Promise<boolean>} True if summarization occurred
   */
  async checkAndSummarize() {
    const tokenRatio = this.history.tokenCount / this.options.maxTokens;
    
    if (tokenRatio >= this.options.summarizeThreshold) {
      await this.summarize();
      return true;
    }
    
    return false;
  }
  
  /**
   * Summarize the conversation history
   * @returns {Promise<Object>} Summary information
   */
  async summarize() {
    const startTime = Date.now();
    
    try {
      // Emit start event
      this.emit('summarize:start', { conversationId: this.conversationId });
      
      // Get current history for summarization
      const history = this.history.getMessages();
      
      // This is a placeholder - in a real implementation, you would:
      // 1. Send history to a summarization service
      // 2. Get back a summary
      // 3. Replace older messages with the summary
      
      // For now, we'll just keep the most recent messages
      const summary = {
        id: `sum_${uuidv4()}`,
        role: 'system',
        content: '[Previous conversation summarized]',
        timestamp: Date.now(),
        isSummary: true
      };
      
      // Replace old messages with summary
      const messagesToKeep = Math.max(1, Math.floor(history.length * 0.5)); // Keep 50% of messages
      const newHistory = [
        summary,
        ...history.slice(-messagesToKeep)
      ];
      
      // Update history
      this.history.replaceHistory(newHistory);
      
      // Emit complete event
      const duration = Date.now() - startTime;
      this.emit('summarize:complete', {
        conversationId: this.conversationId,
        summary,
        duration,
        tokenCount: this.history.tokenCount,
        messageCount: this.history.messageCount
      });
      
      return {
        summary,
        duration,
        tokenCount: this.history.tokenCount,
        messageCount: this.history.messageCount
      };
    } catch (error) {
      this.emit('summarize:error', {
        conversationId: this.conversationId,
        error,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  
  /**
   * Get the current conversation state
   * @returns {Object} Conversation state
   */
  getState() {
    return {
      state: this.state,
      conversationId: this.conversationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastActivity: this.lastActivity,
      messageCount: this.history.messageCount,
      tokenCount: this.history.tokenCount,
      options: { ...this.options }
    };
  }
  
  /**
   * Get conversation history
   * @param {Object} [options] - Options
   * @param {number} [options.limit] - Max number of messages to return
   * @param {boolean} [options.includeSummaries] - Whether to include summary messages
   * @returns {Array<Object>} Array of messages
   */
  getHistory({ limit, includeSummaries = false } = {}) {
    let messages = this.history.getMessages();
    
    if (!includeSummaries) {
      messages = messages.filter(msg => !msg.isSummary);
    }
    
    if (limit) {
      messages = messages.slice(-limit);
    }
    
    return messages;
  }
  
  /**
   * Complete the conversation
   * @param {string} [reason] - Reason for completion
   * @returns {Promise<void>}
   */
  async complete(reason = 'user_request') {
    if (this.state === CONVERSATION_STATES.COMPLETED) {
      return;
    }
    
    // Clear timeouts
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    if (this.maxDurationTimeout) clearTimeout(this.maxDurationTimeout);
    
    // Set state
    this.setState(CONVERSATION_STATES.COMPLETED, { reason });
    
    // Emit event
    this.emit('completed', { 
      conversationId: this.conversationId,
      reason,
      messageCount: this.history.messageCount,
      tokenCount: this.history.tokenCount
    });
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clear timeouts
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    if (this.maxDurationTimeout) clearTimeout(this.maxDurationTimeout);
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export conversation states
ConversationManager.STATES = CONVERSATION_STATES;

module.exports = ConversationManager;
