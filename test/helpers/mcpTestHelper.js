import { WebSocket } from 'ws';
import { expect } from '@jest/globals';

export class MCPTestHelper {
  /**
   * Create a new MCPTestHelper instance
   * @param {Object} options - Configuration options
   * @param {string} [options.serverUrl] - The server URL (default: from global.TEST_SERVER_URL)
   * @param {string} [options.wsUrl] - The WebSocket URL (default: from global.TEST_WS_URL)
   */
  constructor({ serverUrl, wsUrl } = {}) {
    // Set default values
    const defaultServerUrl = 'http://localhost:3001';
    const defaultWsUrl = 'ws://localhost:3001/sse';
    
    // Use provided values or fall back to globals or defaults
    this.serverUrl = serverUrl || global.TEST_SERVER_URL || defaultServerUrl;
    
    // If wsUrl is provided, use it; otherwise try global or construct from serverUrl
    if (wsUrl) {
      this.wsUrl = wsUrl;
    } else if (global.TEST_WS_URL) {
      this.wsUrl = global.TEST_WS_URL;
    } else {
      try {
        // Try to construct WebSocket URL from server URL
        const url = new URL(this.serverUrl);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = '/sse';
        this.wsUrl = url.toString();
      } catch (e) {
        // If URL parsing fails, fall back to default
        this.wsUrl = defaultWsUrl;
      }
    }
    
    this.wsClient = null;
    this.messageQueue = [];
    this.messageHandlers = new Map();
    this.messageId = 1;
    this.mockResponses = new Map();
    this.mockErrors = new Map();
  }

  /**
   * Initialize the test helper
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.connectWebSocket();
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.messageQueue = [];
    this.messageHandlers.clear();
    this.mockResponses.clear();
    this.mockErrors.clear();
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<WebSocket>}
   */
  async connectWebSocket() {
    if (this.wsClient?.readyState === WebSocket.OPEN) {
      return this.wsClient;
    }

    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocket(this.wsUrl);

      this.wsClient.on('open', () => {
        resolve(this.wsClient);
      });

      this.wsClient.on('message', (data) => {
        try {
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          this.messageQueue.push(message);
          
          // Check for matching mock responses
          if (message.id && this.mockResponses.has(message.id)) {
            const response = this.mockResponses.get(message.id);
            this.wsClient.send(JSON.stringify(response));
            this.mockResponses.delete(message.id);
          }
          
          // Check for matching error responses
          if (message.id && this.mockErrors.has(message.id)) {
            const error = this.mockErrors.get(message.id);
            this.wsClient.send(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              error
            }));
            this.mockErrors.delete(message.id);
          }
          
          // Notify any waiting handlers
          if (message.id && this.messageHandlers.has(message.id)) {
            const { resolve } = this.messageHandlers.get(message.id);
            resolve(message);
            this.messageHandlers.delete(message.id);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      });

      this.wsClient.on('error', (err) => {
        console.error('WebSocket error:', err);
        reject(err);
      });
    });
  }

  /**
   * Mock a response for a specific message ID
   * @param {string} messageId - The message ID to mock a response for
   * @param {Object} response - The response to send
   */
  mockResponse(messageId, response) {
    this.mockResponses.set(messageId, response);
  }

  /**
   * Mock an error response for a specific message ID
   * @param {string} messageId - The message ID to mock an error for
   * @param {Object} error - The error object to send
   */
  mockError(messageId, error) {
    this.mockErrors.set(messageId, error);
  }

  /**
   * Send a JSON-RPC message and wait for a response
   * @param {string} method - The JSON-RPC method
   * @param {Object} params - Method parameters
   * @returns {Promise<Object>} - The response
   */
  async sendJsonRpc(method, params = {}) {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }

    const id = `test-${this.messageId++}`;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Store the resolver for when we get a response
      this.messageHandlers.set(id, { resolve, reject });

      // Set a timeout for the response
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 2000);

      // Send the message
      this.wsClient.send(JSON.stringify(message), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.messageHandlers.delete(id);
          reject(err);
        }
      });
    });
  }

  /**
   * Wait for a specific message type
   * @param {string} method - The method to wait for
   * @param {number} [timeout=2000] - Timeout in milliseconds
   * @returns {Promise<Object>}
   */
  async waitForMessage(method, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const checkQueue = () => {
        const index = this.messageQueue.findIndex(msg => 
          msg.method === method || 
          (msg.params && msg.params.method === method)
        );
        
        if (index !== -1) {
          const [message] = this.messageQueue.splice(index, 1);
          resolve(message);
        } else if (timeout > 0) {
          setTimeout(checkQueue, 100);
          timeout -= 100;
        } else {
          reject(new Error(`Timeout waiting for message: ${method}`));
        }
      };
      
      // Check immediately in case the message is already in the queue
      checkQueue();
    });
  }

  /**
   * Clear the message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
  }

  /**
   * Helper to test the agent conversation flow
   * @param {Object} options - Test options
   * @param {string} options.workspaceId - The workspace ID
   * @param {string} options.agentId - The agent ID
   * @param {string} options.message - The initial message
   * @returns {Promise<{conversationId: string, response: Object}>} - The conversation result
   */
  async testAgentConversation({ workspaceId, agentId, message }) {
    // Mock the conversation start response
    const conversationId = 'test-conversation-id';
    this.mockResponse('start-conversation', {
      jsonrpc: '2.0',
      id: 'start-conversation',
      result: {
        conversationId,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: 'Test response' }
        ]
      }
    });

    // Start a new conversation
    const response = await this.sendJsonRpc('startConversation', {
      id: 'start-conversation',
      workspaceId,
      agentId,
      message,
    });

    expect(response).toHaveProperty('result.conversationId');
    return {
      conversationId: response.result.conversationId,
      response: response.result
    };
  }
}
