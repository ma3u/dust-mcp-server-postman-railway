/**
 * Function to list workspace vaults from the Dust.tt API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The unique string identifier for the workspace (required).
 * @returns {Promise<Object>} - The response containing the list of vaults or an error message.
 */
const executeFunction = async () => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with the workspace ID
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/vaults`;

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
    console.error('Error listing workspace vaults:', error);
    return { error: 'An error occurred while listing workspace vaults.' };
  }
};

/**
 * Tool configuration for listing workspace vaults from the Dust.tt API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'list_workspace_vaults',
      description: 'Retrieve a list of vaults for the workspace. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

export { apiTool };