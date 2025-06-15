import { WorkspaceConfig } from '../config/workspace';
import { AgentConfiguration } from '../types/agent';
import NodeCache from 'node-cache';

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;
const agentCache = new NodeCache({ stdTTL: CACHE_TTL });

export class AgentDiscoveryService {
  private static instance: AgentDiscoveryService;
  private cache = agentCache;

  private constructor() {}

  public static getInstance(): AgentDiscoveryService {
    if (!AgentDiscoveryService.instance) {
      AgentDiscoveryService.instance = new AgentDiscoveryService();
    }
    return AgentDiscoveryService.instance;
  }

  private getCacheKey(workspaceId: string): string {
    return `agents:${workspaceId}`;
  }

  public async getAgentConfigurations(
    workspaceConfig: WorkspaceConfig,
    forceRefresh = false
  ): Promise<AgentConfiguration[]> {
    const cacheKey = this.getCacheKey(workspaceConfig.id);
    
    // Return cached agents if available and not forcing refresh
    if (!forceRefresh) {
      const cachedAgents = this.cache.get<AgentConfiguration[]>(cacheKey);
      if (cachedAgents) {
        return cachedAgents;
      }
    }

    try {
      // In a real implementation, this would fetch from the Dust API
      // For now, we'll return a mock response
      const agents: AgentConfiguration[] = [
        {
          id: 'default',
          name: 'Default Agent',
          description: 'Default agent for handling conversations',
          workspaceId: workspaceConfig.id,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Cache the result
      this.cache.set(cacheKey, agents);
      return agents;
    } catch (error) {
      console.error('Error fetching agent configurations:', error);
      throw new Error('Failed to fetch agent configurations');
    }
  }

  public async getAgent(
    workspaceConfig: WorkspaceConfig,
    agentId: string
  ): Promise<AgentConfiguration | undefined> {
    const agents = await this.getAgentConfigurations(workspaceConfig);
    return agents.find((agent) => agent.id === agentId);
  }

  public clearCache(workspaceId?: string): void {
    if (workspaceId) {
      this.cache.del(this.getCacheKey(workspaceId));
    } else {
      this.cache.flushAll();
    }
  }
}
