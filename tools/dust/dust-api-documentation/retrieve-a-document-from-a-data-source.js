/**
 * Function to retrieve a document from a data source in a specified workspace.
 *
 * @param {Object} args - Arguments for the document retrieval.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.vId - The ID of the vault (required).
 * @param {string} args.dsId - The ID of the data source (required).
 * @param {string} args.documentId - The ID of the document (required).
 * @returns {Promise<Object>} - The result of the document retrieval.
 */
const executeFunction = async ({ vId, dsId, documentId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/data_sources/${dsId}/documents/${documentId}`;

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
    console.error('Error retrieving document:', error);
    return { error: 'An error occurred while retrieving the document.' };
  }
};

/**
 * Tool configuration for retrieving a document from a data source.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'retrieve_document',
      description: 'Retrieve a document from a data source. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
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
          documentId: {
            type: 'string',
            description: 'The ID of the document.'
          }
        },
        required: ['vId', 'dsId', 'documentId']
      }
    }
  }
};

export { apiTool };