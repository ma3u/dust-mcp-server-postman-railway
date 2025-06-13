/**
 * Function to list data source views for a specified vault in the Dust API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The unique string identifier for the workspace (required).
 * @param {string} args.vId - The ID of the vault (required).
 * @returns {Promise<Object>} - The response containing the list of data source views.
 */
const executeFunction = async ({ vId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/vaults/${encodeURIComponent(vId)}/data_source_views`;

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
    console.error('Error listing data source views:', error);
    return { error: 'An error occurred while listing data source views.' };
  }
};

/**
 * Tool configuration for listing data source views in the Dust API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'list_data_source_views',
      description: 'Retrieve a list of data source views for the specified vault. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'The ID of the vault.'
          }
        },
        required: ['vId']
      }
    }
  }
};

export { apiTool };