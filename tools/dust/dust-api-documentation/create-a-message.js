/**
 * Function to create a message in a specific conversation within a workspace.
 *
 * @param {Object} args - Arguments for creating a message.
 * @param {string} args.wId - The ID of the workspace.
 * @param {string} args.cId - The ID of the conversation.
 * @param {string} args.content - The content of the message.
 * @param {Array<Object>} [args.mentions] - An array of mention objects containing configuration IDs.
 * @param {Object} args.context - Context information for the message.
 * @param {string} args.context.username - The username of the sender.
 * @param {string} args.context.timezone - The timezone of the sender.
 * @param {string} args.context.fullName - The full name of the sender.
 * @param {string} args.context.email - The email of the sender.
 * @param {string} args.context.profilePictureUrl - The profile picture URL of the sender.
 * @param {string} [args.context.origin="zapier"] - The origin of the message.
 * @returns {Promise<Object>} - The result of the message creation.
 */
const executeFunction = async ({ cId, content, mentions = [], context }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${workspaceId}/assistant/conversations/${cId}/messages`;

    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // If a token is provided, add it to the Authorization header
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create the message payload
    const payload = {
      content,
      mentions,
      context
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating message:', error);
    return { error: 'An error occurred while creating the message.' };
  }
};

/**
 * Tool configuration for creating a message in a conversation.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_message',
      description: 'Create a message in a specific conversation. The workspace ID is determined by the DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          cId: {
            type: 'string',
            description: 'The ID of the conversation.'
          },
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
            description: 'An array of mention objects containing configuration IDs.'
          },
          context: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'The username of the sender.'
              },
              timezone: {
                type: 'string',
                description: 'The timezone of the sender.'
              },
              fullName: {
                type: 'string',
                description: 'The full name of the sender.'
              },
              email: {
                type: 'string',
                description: 'The email of the sender.'
              },
              profilePictureUrl: {
                type: 'string',
                description: 'The profile picture URL of the sender.'
              },
              origin: {
                type: 'string',
                description: 'The origin of the message.'
              }
            },
            required: ['username', 'timezone', 'fullName', 'email', 'profilePictureUrl'],
            description: 'Context information for the message.'
          }
        },
        required: ['cId', 'content', 'context']
      }
    }
  }
};

export { apiTool };