export interface WorkspaceConfig {
    id: string;
    name: string;
    apiKey: string;
    defaultAgentId?: string;
}
export declare function getWorkspaceConfig(workspaceId: string): WorkspaceConfig;
export declare function getDefaultWorkspaceId(): string;
//# sourceMappingURL=workspace.d.ts.map