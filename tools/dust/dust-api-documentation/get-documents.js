/**
 * Function to get documents from a specified data source in a workspace.
 *
 * @param {Object} args - Arguments for the document retrieval.
 * @param {string} args.wId - The ID of the workspace.
 * @param {string} args.vId - The ID of the vault.
 * @param {string} args.dsId - The ID of the data source.
 * @param {number} [args.limit=10] - Limit the number of documents returned.
 * @param {number} [args.offset=0] - Offset the returned documents.
 * @returns {Promise<Object>} - The result of the document retrieval.
 */
const executeFunction = async ({ vId, dsId, limit = 10, offset = 0 }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path and query parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = new URL(`${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/data_sources/${dsId}/documents`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());

    // Set up headers for the request
    const headers = {
      'Accept': 'application/json',
    };

    // If a token is provided, add it to the Authorization header
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
    console.error('Error retrieving documents:', error);
    return { error: 'An error occurred while retrieving documents.' };
  }
};

/**
 * Tool configuration for getting documents from a data source.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_documents',
      description: 'Get documents from a specified data source. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'The ID of the vault.'
          },
          dsId: {
            type: 'string',
            description: 'The ID of the data source.'
          },
          limit: {
            type: 'integer',
            description: 'Limit the number of documents returned.'
          },
          offset: {
            type: 'integer',
            description: 'Offset the returned documents.'
          }
        },
        required: ['vId', 'dsId']
      }
    }
  }
};

export { apiTool };