import { WorkspaceConfig } from '../config/workspace';
import { AgentConfiguration } from '../types/agent';
export declare class AgentDiscoveryService {
    private static instance;
    private cache;
    private constructor();
    static getInstance(): AgentDiscoveryService;
    private getCacheKey;
    getAgentConfigurations(workspaceConfig: WorkspaceConfig, forceRefresh?: boolean): Promise<AgentConfiguration[]>;
    getAgent(workspaceConfig: WorkspaceConfig, agentId: string): Promise<AgentConfiguration | undefined>;
    clearCache(workspaceId?: string): void;
}
//# sourceMappingURL=agentDiscovery.d.ts.map