/**
 * Function to upsert a document in a data source.
 *
 * @param {Object} args - Arguments for the upsert operation.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.vId - The ID of the vault (required).
 * @param {string} args.dsId - The ID of the data source (required).
 * @param {string} args.documentId - The ID of the document (required).
 * @param {string} args.text - The text content of the document.
 * @param {string} args.source_url - The source URL of the document.
 * @param {boolean} args.light_document_output - Flag for light document output.
 * @returns {Promise<Object>} - The result of the upsert operation.
 */
const executeFunction = async ({ vId, dsId, documentId, text, source_url, light_document_output }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with path parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = `${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/data_sources/${dsId}/documents/${documentId}`;

    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // If a token is provided, add it to the Authorization header
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Prepare the request body
    const body = JSON.stringify({
      text,
      source_url,
      light_document_output
    });

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
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
    console.error('Error upserting document:', error);
    return { error: 'An error occurred while upserting the document.' };
  }
};

/**
 * Tool configuration for upserting a document in a data source.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'upsert_document',
      description: 'Upsert a document in a data source. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
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
          },
          text: {
            type: 'string',
            description: 'The text content of the document.'
          },
          source_url: {
            type: 'string',
            description: 'The source URL of the document.'
          },
          light_document_output: {
            type: 'boolean',
            description: 'Flag for light document output.'
          }
        },
        required: ['vId', 'dsId', 'documentId']
      }
    }
  }
};

export { apiTool };