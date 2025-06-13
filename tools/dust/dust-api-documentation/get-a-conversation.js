/**
 * Function to get a conversation from the Dust API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.cId - The ID of the conversation (required).
 * @returns {Promise<Object>} - The result of the conversation retrieval.
 */
const executeFunction = async ({ cId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/assistant/conversations/${encodeURIComponent(cId)}`;

    // Set up headers for the request
    const headers = {
      'Accept': 'application/json',
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
    console.error('Error retrieving conversation:', error);
    return { error: 'An error occurred while retrieving the conversation.' };
  }
};

/**
 * Tool configuration for getting a conversation from the Dust API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_conversation',
      description: 'Get a conversation. The workspace ID is determined by the DUST_WORKSPACE_ID environment variable.',
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