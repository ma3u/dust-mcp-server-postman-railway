const { v4: uuidv4 } = require('uuid');
const { MessageRouter } = require('../message/MessageRouter.js');
const { ConversationManager } = require('../conversation/ConversationManager.js');
const { WorkspaceValidator } = require('../validation/workspaceValidator.js');

/**
 * Service for managing agent interactions with the Dust API.
 * Handles message routing, conversation management, and API communication.
 */
class AgentService {
  /**
   * @param {Object} options - Configuration options
   * @param {SessionManager} options.sessionManager - Session manager instance
   * @param {Object} [options.messageRouter] - Message router configuration
   * @param {Object} [options.conversation] - Conversation manager configuration
   * @param {string} [options.apiKey] - Dust API key
   * @param {string} [options.apiUrl] - Base URL for Dust API
   */
  constructor({
    sessionManager,
    messageRouter: routerConfig = {},
    conversation: conversationConfig = {},
    apiKey = process.env.DUST_API_KEY,
    apiUrl = 'https://dust.tt'
  } = {}) {
    if (!sessionManager) {
      throw new Error('SessionManager is required');
    }
    
    this.sessionManager = sessionManager;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    
    // Initialize workspace validator
    this.validator = new WorkspaceValidator({ apiKey });
    
    // Initialize message router
    this.messageRouter = new MessageRouter({
      sessionManager,
      ...routerConfig
    });
    
    // Override default message processing
    this.messageRouter._processMessage = this._processMessage.bind(this);
    
    // Track conversations by session ID
    this.conversations = new Map();
    
    // Default conversation config
    this.conversationConfig = {
      maxHistory: 50,
      maxTokens: 4000,
      idleTimeout: 5 * 60 * 1000, // 5 minutes
      maxDuration: 60 * 60 * 1000, // 1 hour
      ...conversationConfig
    };
    
    // Bind methods
    this.getOrCreateConversation = this.getOrCreateConversation.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this._processMessage = this._processMessage.bind(this);
    this._callDustApi = this._callDustApi.bind(this);
  }
  
  /**
   * Get or create a conversation for a session
   * @private
   * @param {string} sessionId - Session ID
   * @returns {ConversationManager} Conversation manager instance
   */
  getOrCreateConversation(sessionId) {
    if (!this.conversations.has(sessionId)) {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      const conversation = new ConversationManager({
        sessionManager: this.sessionManager,
        conversationOptions: {
          ...this.conversationConfig,
          conversationId: session.conversationId || `conv_${uuidv4()}`
        }
      });
      
      // Store conversation
      this.conversations.set(sessionId, conversation);
      
      // Clean up on completion
      conversation.on('completed', () => {
        conversation.destroy();
        this.conversations.delete(sessionId);
      });
      
      // Update session with conversation ID if new
      if (!session.conversationId) {
        this.sessionManager.setConversationId(sessionId, conversation.conversationId);
      }
    }
    
    return this.conversations.get(sessionId);
  }
  
  /**
   * Process a message through the agent
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to process
   * @param {string} message.role - Message role (user/assistant/system)
   * @param {string} message.content - Message content
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<Object>} Processing result
   */
  async processMessage(sessionId, message, metadata = {}) {
    try {
      // Get or create conversation
      const conversation = this.getOrCreateConversation(sessionId);
      
      // Add user message to conversation
      await conversation.addMessage({
        role: 'user',
        content: message.content,
        ...metadata
      });
      
      // Queue message for processing
      const result = await this.messageRouter.queueMessage(sessionId, {
        ...message,
        conversationId: conversation.conversationId
      });
      
      return {
        success: true,
        messageId: result.messageId,
        conversationId: conversation.conversationId
      };
    } catch (error) {
      console.error('[AgentService] Error processing message:', error);
      throw error;
    }
  }
  
  /**
   * Process a message (called by MessageRouter)
   * @private
   * @param {Object} session - Session object
   * @param {Object} message - Message to process
   * @returns {Promise<Object>} Processing result
   */
  async _processMessage(session, message) {
    const { sessionId, workspaceId, agentId, conversationId } = session;
    
    try {
      // Get conversation
      const conversation = this.getOrCreateConversation(sessionId);
      
      // Get conversation history
      const history = conversation.getHistory({ includeSummaries: true });
      
      // Call Dust API
      const response = await this._callDustApi({
        workspaceId,
        agentId,
        conversationId: conversation.conversationId,
        messages: history,
        ...message
      });
      
      // Add assistant response to conversation
      const assistantMessage = {
        role: 'assistant',
        content: response.content,
        messageId: response.messageId,
        metadata: {
          tokens: response.tokens,
          model: response.model
        }
      };
      
      await conversation.addMessage(assistantMessage);
      
      return {
        success: true,
        messageId: response.messageId,
        content: response.content,
        conversationId: conversation.conversationId
      };
    } catch (error) {
      console.error('[AgentService] Error in _processMessage:', error);
      
      // Add error message to conversation
      try {
        await conversation.addMessage({
          role: 'system',
          content: 'An error occurred while processing your message. Please try again.',
          isError: true,
          error: error.message
        });
      } catch (e) {
        console.error('[AgentService] Error adding error message to conversation:', e);
      }
      
      throw error;
    }
  }
  
  /**
   * Call the Dust API
   * @private
   * @param {Object} options - API call options
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.agentId - Agent ID
   * @param {string} options.conversationId - Conversation ID
   * @param {Array} options.messages - Conversation history
   * @param {string} [options.model] - Model to use
   * @returns {Promise<Object>} API response
   */
  async _callDustApi({
    workspaceId,
    agentId,
    conversationId,
    messages,
    model = 'gpt-4'
  }) {
    const url = conversationId
      ? `${this.apiUrl}/api/workspaces/${workspaceId}/conversations/${conversationId}/messages`
      : `${this.apiUrl}/api/workspaces/${workspaceId}/conversations`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        message: messages[messages.length - 1].content,
        agentId,
        model,
        stream: false,
        context: {
          previousMessages: messages.slice(0, -1)
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return {
      messageId: data.messageId,
      content: data.content,
      tokens: data.usage?.total_tokens,
      model: data.model
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clean up all conversations
    for (const [sessionId, conversation] of this.conversations.entries()) {
      try {
        conversation.destroy();
      } catch (error) {
        console.error(`[AgentService] Error destroying conversation for session ${sessionId}:`, error);
      }
    }
    
    this.conversations.clear();
    
    // Clean up message router
    if (this.messageRouter) {
      this.messageRouter.destroy();
    }
  }
}

module.exports = AgentService;
