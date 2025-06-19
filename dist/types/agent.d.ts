export interface AgentConfiguration {
    id: string;
    name: string;
    description: string;
    workspaceId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
}
export interface AgentDiscoveryResponse {
    agents: AgentConfiguration[];
    nextPageToken?: string;
    totalAgents?: number;
}
export interface AgentDiscoveryOptions {
    activeOnly?: boolean;
    limit?: number;
    pageToken?: string;
    metadataFilter?: Record<string, unknown>;
}
//# sourceMappingURL=agent.d.ts.map