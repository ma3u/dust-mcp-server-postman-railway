/**
 * Function to create a content fragment in a specified workspace and conversation.
 *
 * @param {Object} args - Arguments for creating the content fragment.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.cId - The ID of the conversation (required).
 * @param {string} args.title - The title of the content fragment.
 * @param {string} args.content - The content of the fragment.
 * @param {string} args.url - The URL associated with the content fragment.
 * @param {string} args.contentType - The content type of the fragment.
 * @param {Object} args.context - The context information for the content fragment.
 * @param {string} args.context.username - The username of the user creating the fragment.
 * @param {string} args.context.timezone - The timezone of the user.
 * @param {string} args.context.fullName - The full name of the user.
 * @param {string} args.context.email - The email of the user.
 * @param {string} args.context.profilePictureUrl - The profile picture URL of the user.
 * @returns {Promise<Object>} - The result of the content fragment creation.
 */
const executeFunction = async ({ cId, title, content, url, contentType, context }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const urlWithParams = `${baseUrl}/api/v1/w/${workspaceId}/assistant/conversations/${cId}/content_fragments`;

    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Construct the body of the request
    const body = JSON.stringify({
      title,
      content,
      url,
      contentType,
      context
    });

    // Perform the fetch request
    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers,
      body
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
    console.error('Error creating content fragment:', error);
    return { error: 'An error occurred while creating the content fragment.' };
  }
};

/**
 * Tool configuration for creating a content fragment in the Dust API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_content_fragment',
      description: 'Create a new content fragment in a conversation. The workspace ID is determined by the DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          cId: {
            type: 'string',
            description: 'The ID of the conversation.'
          },
          title: {
            type: 'string',
            description: 'The title of the content fragment.'
          },
          content: {
            type: 'string',
            description: 'The content of the fragment.'
          },
          url: {
            type: 'string',
            description: 'The URL associated with the content fragment.'
          },
          contentType: {
            type: 'string',
            description: 'The content type of the fragment.'
          },
          context: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'The username of the user creating the fragment.'
              },
              timezone: {
                type: 'string',
                description: 'The timezone of the user.'
              },
              fullName: {
                type: 'string',
                description: 'The full name of the user.'
              },
              email: {
                type: 'string',
                description: 'The email of the user.'
              },
              profilePictureUrl: {
                type: 'string',
                description: 'The profile picture URL of the user.'
              }
            },
            required: ['username', 'timezone', 'fullName', 'email', 'profilePictureUrl']
          }
        },
        required: ['cId', 'title', 'content', 'url', 'contentType', 'context']
      }
    }
  }
};

export { apiTool };