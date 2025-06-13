/**
 * Function to search for agent configurations by name in a specified workspace.
 *
 * @param {Object} args - Arguments for the search.
 * @param {string} args.wId - The ID of the workspace.
 * @param {string} args.q - The search query for agent configuration names.
 * @returns {Promise<Object>} - The result of the agent configuration search.
 */
const executeFunction = async ({ q }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with query parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = new URL(`${baseUrl}/api/v1/w/${workspaceId}/assistant/agent_configurations/search`);
    url.searchParams.append('q', q);

    // Set up headers for the request
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
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
    console.error('Error searching for agent configurations:', error);
    return { error: 'An error occurred while searching for agent configurations.' };
  }
};

/**
 * Tool configuration for searching agent configurations in a workspace.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_assistants_by_name',
      description: 'Search for agent configurations by name. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'The search query for agent configuration names.'
          }
        },
        required: ['q']
      }
    }
  }
};

export { apiTool };