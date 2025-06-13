/**
 * Function to get the events for a conversation in a specified workspace.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.cId - The ID of the conversation (required).
 * @returns {Promise<Object>} - The response data from the API.
 */
const executeFunction = async ({ cId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/assistant/conversations/${encodeURIComponent(cId)}/events`;

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers
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
    console.error('Error getting events for conversation:', error);
    return { error: 'An error occurred while getting events for the conversation.' };
  }
};

/**
 * Tool configuration for getting events for a conversation in a workspace.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_conversation_events',
      description: 'Get the events for a conversation. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          cId: {
            type: 'string',
            description: 'The ID of the conversation.'
          }
        },
        required: ['cId']
      }
    }
  }
};

export { apiTool };