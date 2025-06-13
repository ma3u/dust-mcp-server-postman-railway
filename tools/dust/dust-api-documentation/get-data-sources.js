/**
 * Function to get data sources from the Dust API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.vId - The ID of the vault (required).
 * @returns {Promise<Object>} - The response containing data sources or an error message.
 */
const executeFunction = async ({ vId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/vaults/${encodeURIComponent(vId)}/data_sources`;

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
    console.error('Error fetching data sources:', error);
    return { error: 'An error occurred while fetching data sources.' };
  }
};

/**
 * Tool configuration for getting data sources from the Dust API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_data_sources',
      description: 'Get data sources in a vault. The workspace ID is determined by the DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'The ID of the vault (required).'
          }
        },
        required: ['vId']
      }
    }
  }
};

export { apiTool };