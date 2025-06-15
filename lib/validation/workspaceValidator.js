import fetch from 'node-fetch';

/**
 * Validates workspace and agent configurations
 */
class WorkspaceValidator {
  /**
   * @param {Object} options - Validator options
   * @param {string} options.apiKey - Dust API key
   * @param {string} [options.apiUrl='https://dust.tt/api/v1'] - Base API URL
   * @param {number} [options.cacheTtl=300000] - Cache TTL in milliseconds (5 minutes)
   */
  constructor({ apiKey, apiUrl = 'https://dust.tt/api/v1', cacheTtl = 300000 } = {}) {
    if (!apiKey) {
      throw new Error('API key is required for WorkspaceValidator');
    }

    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.cacheTtl = cacheTtl;
    this.validWorkspaces = new Map(); // workspaceId -> { valid: boolean, agents: Set, expiresAt: number }
  }

  /**
   * Check if a workspace is valid
   * @param {string} workspaceId - Workspace ID to validate
   * @returns {Promise<{valid: boolean, exists: boolean, error?: string}>}
   */
  async validateWorkspace(workspaceId) {
    if (!workspaceId) {
      return { valid: false, exists: false, error: 'Workspace ID is required' };
    }

    // Check cache first
    const cached = this.validWorkspaces.get(workspaceId);
    if (cached && cached.expiresAt > Date.now()) {
      return { valid: true, exists: true };
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/w/${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        return { valid: false, exists: false, error: 'Workspace not found' };
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { 
          valid: false, 
          exists: false, 
          error: error.message || `HTTP error! status: ${response.status}`
        };
      }

      // Cache the valid workspace
      this.validWorkspaces.set(workspaceId, {
        valid: true,
        agents: new Map(),
        expiresAt: Date.now() + this.cacheTtl
      });

      return { valid: true, exists: true };
    } catch (error) {
      console.error(`[WorkspaceValidator] Error validating workspace ${workspaceId}:`, error);
      return { 
        valid: false, 
        exists: false, 
        error: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Check if an agent exists in a workspace
   * @param {string} workspaceId - Workspace ID
   * @param {string} agentId - Agent ID to validate
   * @returns {Promise<{valid: boolean, exists: boolean, error?: string}>}
   */
  async validateAgent(workspaceId, agentId) {
    if (!workspaceId || !agentId) {
      return { 
        valid: false, 
        exists: false, 
        error: 'Workspace ID and Agent ID are required' 
      };
    }

    // Check workspace first
    const workspaceValid = await this.validateWorkspace(workspaceId);
    if (!workspaceValid.valid) {
      return workspaceValid;
    }

    const workspaceCache = this.validWorkspaces.get(workspaceId);
    
    // Check agent cache
    const agentCache = workspaceCache.agents.get(agentId);
    if (agentCache && agentCache.expiresAt > Date.now()) {
      return { valid: true, exists: true };
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/w/${workspaceId}/assistant/agent_configurations/${agentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        return { valid: false, exists: false, error: 'Agent not found' };
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { 
          valid: false, 
          exists: false, 
          error: error.message || `HTTP error! status: ${response.status}`
        };
      }

      // Cache the valid agent
      workspaceCache.agents.set(agentId, {
        valid: true,
        expiresAt: Date.now() + this.cacheTtl
      });

      return { valid: true, exists: true };
    } catch (error) {
      console.error(
        `[WorkspaceValidator] Error validating agent ${agentId} in workspace ${workspaceId}:`,
        error
      );
      return { 
        valid: false, 
        exists: false, 
        error: `Agent validation failed: ${error.message}`
      };
    }
  }

  /**
   * Clear the validation cache
   */
  clearCache() {
    this.validWorkspaces.clear();
  }
}

export { WorkspaceValidator };
