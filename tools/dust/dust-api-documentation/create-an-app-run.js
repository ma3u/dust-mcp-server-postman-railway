/**
 * Function to create and execute a run for an app in the specified vault.
 *
 * @param {Object} args - Arguments for creating an app run.
 * @param {string} args.wId - Unique string identifier for the workspace (required).
 * @param {string} args.vId - ID of the vault (required).
 * @param {string} args.aId - Unique identifier of the app (required).
 * @param {string} args.specification_hash - Specification hash for the run.
 * @param {Object} args.config - Configuration for the model.
 * @param {Object} args.config.model - Model configuration.
 * @param {string} args.config.model.provider_id - Provider ID for the model.
 * @param {string} args.config.model.model_id - Model ID.
 * @param {boolean} args.config.model.use_cache - Whether to use cache.
 * @param {boolean} args.config.model.use_stream - Whether to use streaming.
 * @param {Array<Object>} args.inputs - Input data for the run.
 * @param {boolean} [args.stream] - Whether to stream the results.
 * @param {boolean} [args.blocking] - Whether the request should be blocking.
 * @param {Array<string>} [args.block_filter] - Filters for blocking.
 * @returns {Promise<Object>} - The result of the app run creation.
 */
const executeFunction = async ({ vId, specification_hash, config, inputs, stream, blocking, block_filter }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with path variables
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const appId = process.env.DUST_AGENT_ID;
    const url = `${baseUrl}/api/v1/w/${workspaceId}/vaults/${vId}/apps/${appId}/runs`;

    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Create the body for the request
    const body = JSON.stringify({
      specification_hash,
      config,
      inputs,
      stream,
      blocking,
      block_filter
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
    console.error('Error creating app run:', error);
    return { error: 'An error occurred while creating the app run.' };
  }
};

/**
 * Tool configuration for creating an app run in the Dust API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_app_run',
      description: 'Create and execute a run for an app in the specified vault. The workspace ID and app ID are determined by DUST_WORKSPACE_ID and DUST_AGENT_ID environment variables respectively.',
      parameters: {
        type: 'object',
        properties: {
          vId: {
            type: 'string',
            description: 'ID of the vault.'
          },
          specification_hash: {
            type: 'string',
            description: 'Specification hash for the run.'
          },
          config: {
            type: 'object',
            description: 'Configuration for the model.',
            properties: {
              model: {
                type: 'object',
                description: 'Model configuration.',
                properties: {
                  provider_id: {
                    type: 'string',
                    description: 'Provider ID for the model.'
                  },
                  model_id: {
                    type: 'string',
                    description: 'Model ID.'
                  },
                  use_cache: {
                    type: 'boolean',
                    description: 'Whether to use cache.'
                  },
                  use_stream: {
                    type: 'boolean',
                    description: 'Whether to use streaming.'
                  }
                },
                required: ['provider_id', 'model_id']
              }
            },
            required: ['model']
          },
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              description: 'Input data for the run.'
            },
            description: 'Input data for the run.'
          },
          stream: {
            type: 'boolean',
            description: 'Whether to stream the results.'
          },
          blocking: {
            type: 'boolean',
            description: 'Whether the request should be blocking.'
          },
          block_filter: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Filters for blocking.'
          }
        },
        required: ['vId']
      }
    }
  }
};

export { apiTool };