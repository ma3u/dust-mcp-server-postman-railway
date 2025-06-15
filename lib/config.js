// lib/config.js
'use strict';

/**
 * @fileoverview Configuration manager for the MCP Server.
 * Loads settings from environment variables.
 */

const WORKSPACE_ID_ENV_VAR = 'DUST_MCP_WORKSPACE_ID';

/**
 * Retrieves the workspace ID.
 * Primarily from the DUST_MCP_WORKSPACE_ID environment variable.
 * @returns {string | undefined} The workspace ID, or undefined if not set.
 */
function getWorkspaceId() {
  return process.env[WORKSPACE_ID_ENV_VAR];
}

/**
 * Checks if a workspace ID is configured.
 * @returns {boolean} True if a workspace ID is set, false otherwise.
 */
function isWorkspaceConfigured() {
  return !!process.env[WORKSPACE_ID_ENV_VAR];
}

module.exports = {
  getWorkspaceId,
  isWorkspaceConfigured,
  // Constant for header name, can be used by server/transport layers
  WORKSPACE_ID_HEADER: 'X-Dust-Workspace-Id',
};
