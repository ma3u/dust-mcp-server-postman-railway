/**
 * Function to list assistants for a specified workspace in the Dust API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The ID of the workspace.
 * @returns {Promise<Object>} - The response containing the agent configurations for the workspace.
 */
const executeFunction = async () => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with the workspace ID
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${encodeURIComponent(workspaceId)}/assistant/agent_configurations`;

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
    console.error('Error listing assistants:', error);
    return { error: 'An error occurred while listing assistants.' };
  }
};

/**
 * Tool configuration for listing assistants in a workspace.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'list_assistants',
      description: 'Get the agent configurations for the workspace. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

export { apiTool };