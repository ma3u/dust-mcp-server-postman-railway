/**
 * Function to get events for a message in a specified workspace.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.wId - The ID of the workspace (required).
 * @param {string} args.cId - The ID of the conversation (required).
 * @param {string} args.mId - The ID of the message (required).
 * @param {string} [args.lastEventId] - The ID of the last event received (optional).
 * @returns {Promise<Object>} - The response data containing events for the message.
 */
const executeFunction = async ({ cId, mId, lastEventId }) => {
  const baseUrl = 'https://dust.tt';
  const token = process.env.DUST_API_KEY;

  try {
    // Construct the URL with path variables and query parameters
    const workspaceId = process.env.DUST_WORKSPACE_ID;
    const url = new URL(`${baseUrl}/api/v1/w/${workspaceId}/assistant/conversations/${cId}/messages/${mId}/events`);
    if (lastEventId) {
      url.searchParams.append('lastEventId', lastEventId);
    }

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
    console.error('Error getting events for message:', error);
    return { error: 'An error occurred while getting events for the message.' };
  }
};

/**
 * Tool configuration for getting events for a message in a workspace.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_events_for_message',
      description: 'Get events for a message. Workspace ID is determined by DUST_WORKSPACE_ID environment variable.',
      parameters: {
        type: 'object',
        properties: {
          cId: {
            type: 'string',
            description: 'The ID of the conversation.'
          },
          mId: {
            type: 'string',
            description: 'The ID of the message.'
          },
          lastEventId: {
            type: 'string',
            description: 'The ID of the last event received.'
          }
        },
        required: ['cId', 'mId']
      }
    }
  }
};

export { apiTool };