import dotenv from 'dotenv';

dotenv.config();

export interface WorkspaceConfig {
  id: string;
  name: string;
  apiKey: string;
  defaultAgentId?: string;
}

export function getWorkspaceConfig(workspaceId: string): WorkspaceConfig {
  const workspaceKey = `WORKSPACE_${workspaceId.toUpperCase()}`;
  const apiKey = process.env[`${workspaceKey}_API_KEY`];
  const name = process.env[`${workspaceKey}_NAME`] || workspaceId;
  const defaultAgentId = process.env[`${workspaceKey}_DEFAULT_AGENT`];

  if (!apiKey) {
    throw new Error(`Missing configuration for workspace: ${workspaceId}`);
  }

  return {
    id: workspaceId,
    name,
    apiKey,
    defaultAgentId,
  };
}

export function getDefaultWorkspaceId(): string {
  return process.env.DEFAULT_WORKSPACE_ID || 'default';
}
