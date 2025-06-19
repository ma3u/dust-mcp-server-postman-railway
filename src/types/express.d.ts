import { WorkspaceConfig } from '../config/workspace';

declare global {
  namespace Express {
    interface Request {
      workspaceConfig: WorkspaceConfig;
    }
  }
}

export {};
