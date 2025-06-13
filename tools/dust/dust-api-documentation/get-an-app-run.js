/**
 * Function to retrieve a run for an app in the vault.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - Unique string identifier for the workspace.
 * @param {string} args.vId - ID of the vault.
 * @param {string} args.aId - ID of the app.
 * @param {string} args.runId - ID of the run.
 * @returns {Promise<Object>} - The result of the app run retrieval.
 */
const executeFunction = async ({ vId, runId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const appId = process.env.DUST_AGENT_ID;
    const url = `${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/apps/${appId}/runs/${runId}`;

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
    console.error('Error retrieving app run:', error);
    return { error: 'An error occurred while retrieving the app run.' };
  }
};

/**
 * Tool configuration for retrieving an app run.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_app_run',
      description: 'Retrieve a run for an app in the vault. Workspace and App IDs are determined by DUST_WORKSPACE_ID and DUST_AGENT_ID environment variables.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'ID of the vault.'
          },
          runId: {
            type: 'string',
            description: 'ID of the run.'
          }
        },
        required: ['vId', 'runId']
      }
    }
  }
};

export { apiTool };