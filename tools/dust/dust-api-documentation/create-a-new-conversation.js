/**
 * Function to create a new conversation in the Dust.tt API.
 *
 * @param {Object} args - Arguments for creating a conversation.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.content - The content of the message.
 * @param {Array} args.mentions - An array of mention objects containing configuration IDs.
 * @param {Object} args.context - The context object containing user information.
 * @param {string} args.title - The title of the conversation.
 * @param {boolean} args.blocking - Indicates if the request should be blocking.
 * @param {string} args.visibility - The visibility setting for the conversation.
 * @returns {Promise<Object>} - The result of the conversation creation.
 */
const executeFunction = async ({ content, mentions, context, title, blocking, visibility }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  const requestBody = {
    message: {
      content,
      mentions,
      context
    },
    contentFragment: {
      title,
      content,
      url: '',
      contentType: '',
      context
    },
    blocking,
    title,
    visibility
  };

  try {
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const response = await fetch(`${baseUrl}/api/v1/w/${workspaceId}/assistant/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating conversation:', error);
    return { error: 'An error occurred while creating the conversation.' };
  }
};

/**
 * Tool configuration for creating a conversation in the Dust.tt API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_conversation',
      description: 'Create a new conversation. The workspace ID is determined by the DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content of the message.'
          },
          mentions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                configurationId: {
                  type: 'string',
                  description: 'The configuration ID for the mention.'
                }
              }
            },
            description: 'An array of mention objects.'
          },
          context: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              timezone: { type: 'string' },
              fullName: { type: 'string' },
              email: { type: 'string' },
              profilePictureUrl: { type: 'string' },
              origin: { type: 'string' }
            },
            description: 'The context object containing user information.'
          },
          title: {
            type: 'string',
            description: 'The title of the conversation.'
          },
          blocking: {
            type: 'boolean',
            description: 'Indicates if the request should be blocking.'
          },
          visibility: {
            type: 'string',
            description: 'The visibility setting for the conversation.'
          }
        },
        required: ['content', 'mentions', 'context', 'title', 'blocking', 'visibility']
      }
    }
  }
};

export { apiTool };