/**
 * Represents the configuration of an agent in the system.
 */
export interface AgentConfiguration {
  /**
   * Unique identifier for the agent
   */
  id: string;
  
  /**
   * Human-readable name of the agent
   */
  name: string;
  
  /**
   * Description of the agent's purpose and capabilities
   */
  description: string;
  
  /**
   * ID of the workspace this agent belongs to
   */
  workspaceId: string;
  
  /**
   * Whether the agent is active and available for use
   */
  isActive: boolean;
  
  /**
   * Timestamp when the agent was created
   */
  createdAt: string;
  
  /**
   * Timestamp when the agent was last updated
   */
  updatedAt: string;
  
  /**
   * Optional metadata about the agent
   */
  metadata?: Record<string, unknown>;
}

/**
 * Response format for agent discovery operations
 */
export interface AgentDiscoveryResponse {
  /**
   * List of available agent configurations
   */
  agents: AgentConfiguration[];
  
  /**
   * Pagination token for the next page of results, if any
   */
  nextPageToken?: string;
  
  /**
   * Total number of agents available (may be an estimate)
   */
  totalAgents?: number;
}

/**
 * Options for discovering agents
 */
export interface AgentDiscoveryOptions {
  /**
   * Filter agents by active status
   */
  activeOnly?: boolean;
  
  /**
   * Maximum number of agents to return
   */
  limit?: number;
  
  /**
   * Pagination token for the next page of results
   */
  pageToken?: string;
  
  /**
   * Filter agents by metadata
   */
  metadataFilter?: Record<string, unknown>;
}
