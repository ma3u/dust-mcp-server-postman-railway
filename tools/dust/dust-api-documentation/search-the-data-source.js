/**
 * Function to search the data source in the Dust.tt API.
 *
 * @param {Object} args - Arguments for the search.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.vId - The ID of the vault (required).
 * @param {string} args.dsId - The ID of the data source (required).
 * @param {string} args.query - The search query (required).
 * @param {number} args.top_k - The number of results to return (required).
 * @param {boolean} args.full_text - Whether to perform a full text search (required).
 * @param {number} [args.target_document_tokens] - The number of tokens in the target document.
 * @param {number} [args.timestamp_gt] - The timestamp to filter by (greater than).
 * @param {number} [args.timestamp_lt] - The timestamp to filter by (less than).
 * @param {string} [args.tags_in] - The tags to filter by (included).
 * @param {string} [args.tags_not] - The tags to filter by (not included).
 * @param {string} [args.parents_in] - The parents to filter by (included).
 * @param {string} [args.parents_not] - The parents to filter by (not included).
 * @returns {Promise<Object>} - The result of the search request.
 */
const executeFunction = async ({ vId, dsId, query, top_k, full_text, target_document_tokens, timestamp_gt, timestamp_lt, tags_in, tags_not, parents_in, parents_not }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;
  try {
    // Construct the URL with path and query parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = new URL(`${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/data_sources/${dsId}/search`);
    url.searchParams.append('query', query);
    url.searchParams.append('top_k', top_k.toString());
    url.searchParams.append('full_text', full_text.toString());
    if (target_document_tokens) url.searchParams.append('target_document_tokens', target_document_tokens.toString());
    if (timestamp_gt) url.searchParams.append('timestamp_gt', timestamp_gt.toString());
    if (timestamp_lt) url.searchParams.append('timestamp_lt', timestamp_lt.toString());
    if (tags_in) url.searchParams.append('tags_in', tags_in);
    if (tags_not) url.searchParams.append('tags_not', tags_not);
    if (parents_in) url.searchParams.append('parents_in', parents_in);
    if (parents_not) url.searchParams.append('parents_not', parents_not);

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
    console.error('Error searching the data source:', error);
    return { error: 'An error occurred while searching the data source.' };
  }
};

/**
 * Tool configuration for searching the data source in the Dust.tt API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_data_source',
      description: 'Search the data source. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'The ID of the vault (required).'
          },
          dsId: {
            type: 'string',
            description: 'The ID of the data source (required).'
          },
          query: {
            type: 'string',
            description: 'The search query (required).'
          },
          top_k: {
            type: 'integer',
            description: 'The number of results to return (required).'
          },
          full_text: {
            type: 'boolean',
            description: 'Whether to perform a full text search (required).'
          },
          target_document_tokens: {
            type: 'integer',
            description: 'The number of tokens in the target document.'
          },
          timestamp_gt: {
            type: 'integer',
            description: 'The timestamp to filter by (greater than).'
          },
          timestamp_lt: {
            type: 'integer',
            description: 'The timestamp to filter by (less than).'
          },
          tags_in: {
            type: 'string',
            description: 'The tags to filter by (included).'
          },
          tags_not: {
            type: 'string',
            description: 'The tags to filter by (not included).'
          },
          parents_in: {
            type: 'string',
            description: 'The parents to filter by (included).'
          },
          parents_not: {
            type: 'string',
            description: 'The parents to filter by (not included).'
          }
        },
        required: ['vId', 'dsId', 'query', 'top_k', 'full_text']
      }
    }
  }
};

export { apiTool };