const { SessionManager } = require('../../lib/sessionManager.js');
const { StreamingHandler } = require('../../lib/streamingHandler.js');

// Initialize session manager and streaming handler
const sessionManager = new SessionManager();
const streamingHandler = new StreamingHandler(sessionManager);

// Cache for agent configurations
const agentConfigCache = {
  data: null,
  lastUpdated: 0,
  ttl: 5 * 60 * 1000, // 5 minutes TTL

  /**
   * Check if the cache is still valid
   * @returns {boolean} True if cache is valid, false otherwise
   */
  isValid() {
    return this.data && (Date.now() - this.lastUpdated) < this.ttl;
  },

  /**
   * Update the cache with new data
   * @param {Object} data - The data to cache
   */
  update(data) {
    this.data = data;
    this.lastUpdated = Date.now();
  },

  /**
   * Get the cached data
   * @returns {Object|null} The cached data or null if invalid/expired
   */
  get() {
    return this.isValid() ? this.data : null;
  }
};

/**
 * List available agents in the workspace
 */
/**
 * Fetches agent configurations from the API with caching
 * @param {boolean} [forceRefresh=false] - If true, bypasses the cache
 * @returns {Promise<Object>} Agent configurations
 * @throws {Error} If the request fails or workspace is not configured
 */
async function fetchAgentConfigurations(forceRefresh = false) {
  const workspaceId = process.env.DUST_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error('DUST_WORKSPACE_ID environment variable not set');
  }

  // Return cached data if valid and not forcing refresh
  if (!forceRefresh) {
    const cachedData = agentConfigCache.get();
    if (cachedData) {
      console.error('[fetchAgentConfigurations] Using cached agent configurations');
      return cachedData;
    }
  }

  try {
    console.error(`[fetchAgentConfigurations] Fetching fresh agent configurations for workspace ${workspaceId}`);
    const response = await fetch(
      `https://dust.tt/api/v1/w/${workspaceId}/assistant/agent_configurations`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DUST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Update cache with fresh data
    agentConfigCache.update(data);
    
    return data;
  } catch (error) {
    console.error('[fetchAgentConfigurations] Error:', error);
    // If we have stale cache and there's an error, return the stale data
    const staleData = agentConfigCache.data;
    if (staleData) {
      console.error('[fetchAgentConfigurations] Using stale cache due to error');
      return staleData;
    }
    throw new Error(`Failed to fetch agent configurations: ${error.message}`);
  }
}

/**
 * Lists all available agents in the workspace
 * @param {Object} [options] - Options
 * @param {boolean} [options.forceRefresh=false] - If true, bypasses the cache
 * @returns {Promise<Object>} Object containing the list of agents
 */
async function listAgents({ forceRefresh = false } = {}) {
  try {
    const data = await fetchAgentConfigurations(forceRefresh);
    
    return {
      agents: data.agentConfigurations.map(agent => ({
        id: agent.sId,
        name: agent.name,
        description: agent.description,
        version: agent.version,
        status: agent.status,
        model: agent.model?.providerId || 'unknown',
        createdAt: agent.createdAt
      }))
    };
  } catch (error) {
    console.error('[listAgents] Error:', error);
    throw new Error(`Failed to list agents: ${error.message}`);
  }
}

/**
 * Create a new conversation with an agent
 */
async function createConversation({ agentId, message, sessionId }) {
  try {
    if (!agentId) {
      throw new Error('agentId is required');
    }

    // Create or get existing session
    let session = sessionId ? sessionManager.getSession(sessionId) : null;
    if (!session) {
      const workspaceId = process.env.DUST_WORKSPACE_ID;
      if (!workspaceId) {
        throw new Error('DUST_WORKSPACE_ID environment variable not set');
      }
      session = sessionManager.createSession(workspaceId, agentId);
      sessionId = session.id;
    }

    // If no message provided, just return the session
    if (!message) {
      return {
        sessionId: session.id,
        conversationId: session.conversationId,
        status: session.conversationId ? 'existing' : 'pending'
      };
    }

    // If we have a message, start streaming the response
    const responseChunks = [];
    let conversationId = session.conversationId;
    
    for await (const chunk of streamingHandler.streamResponse(session.id, message)) {
      responseChunks.push(chunk);
      if (chunk.conversationId && !conversationId) {
        conversationId = chunk.conversationId;
      }
    }

    if (!conversationId) {
      throw new Error('Failed to get conversation ID from response');
    }

    return {
      sessionId: session.id,
      conversationId,
      chunks: responseChunks,
      status: 'completed'
    };
  } catch (error) {
    console.error('[createConversation] Error:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
}

/**
 * Send a message in an existing conversation
 */
async function sendMessage({ sessionId, message, stream = false }) {
  try {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }
    if (!message) {
      throw new Error('message is required');
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    if (stream) {
      // For streaming responses, return an async generator
      return {
        stream: true,
        generator: streamingHandler.streamResponse(sessionId, message)
      };
    }

    // For non-streaming responses, collect all chunks and return them
    const responseChunks = [];
    for await (const chunk of streamingHandler.streamResponse(sessionId, message)) {
      responseChunks.push(chunk);
    }

    return {
      sessionId,
      conversationId: session.conversationId,
      chunks: responseChunks,
      status: 'completed'
    };
  } catch (error) {
    console.error('[sendMessage] Error:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

// Export tool definitions
const agentTools = [
  {
    function: listAgents,
    definition: {
      type: 'function',
      function: {
        name: 'list_agents',
        description: 'List available agents in the workspace',
        parameters: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Optional search query to filter agents by name' 
            }
          }
        }
      }
    }
  },
  {
    function: createConversation,
    definition: {
      type: 'function',
      function: {
        name: 'create_conversation',
        description: 'Create a new conversation with an agent',
        parameters: {
          type: 'object',
          properties: {
            agentId: { 
              type: 'string', 
              description: 'ID of the agent to talk to' 
            },
            message: { 
              type: 'string', 
              description: 'Initial message to send to the agent' 
            },
            sessionId: {
              type: 'string',
              description: 'Optional existing session ID to continue conversation'
            }
          },
          required: ['agentId']
        }
      }
    }
  },
  {
    function: sendMessage,
    definition: {
      type: 'function',
      function: {
        name: 'send_message',
        description: 'Send a message in an existing conversation',
        parameters: {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'ID of the session to send the message in' 
            },
            message: { 
              type: 'string', 
              description: 'Message content to send' 
            },
            stream: {
              type: 'boolean',
              description: 'Whether to stream the response',
              default: false
            }
          },
          required: ['sessionId', 'message']
        }
      }
    }
  }
];

module.exports = { agentTools };
