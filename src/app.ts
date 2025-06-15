import express, { Application, Request, Response, NextFunction } from 'express';
import { getWorkspaceConfig, getDefaultWorkspaceId } from './config/workspace';
import { AgentDiscoveryService } from './services/agentDiscovery';
import { AgentConfiguration } from './types/agent';

class App {
  public app: Application;
  private agentDiscovery: AgentDiscoveryService;

  constructor() {
    this.app = express();
    this.agentDiscovery = AgentDiscoveryService.getInstance();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });

    // Get agent configurations
    this.app.get(
      '/api/workspaces/:workspaceId/agents',
      this.handleWorkspaceRequest.bind(this),
      this.getAgentConfigurations.bind(this)
    );

    // Get a specific agent
    this.app.get(
      '/api/workspaces/:workspaceId/agents/:agentId',
      this.handleWorkspaceRequest.bind(this),
      this.getAgent.bind(this)
    );
  }

  private async handleWorkspaceRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workspaceId = req.params.workspaceId || getDefaultWorkspaceId();
      const workspaceConfig = getWorkspaceConfig(workspaceId);
      req.workspaceConfig = workspaceConfig;
      next();
    } catch (error) {
      next(error);
    }
  }

  private async getAgentConfigurations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const forceRefresh = req.query.forceRefresh === 'true';
      const agents = await this.agentDiscovery.getAgentConfigurations(
        req.workspaceConfig,
        forceRefresh
      );
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }

  private async getAgent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { agentId } = req.params;
      const agent = await this.agentDiscovery.getAgent(
        req.workspaceConfig,
        agentId
      );

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      res.json(agent);
    } catch (error) {
      next(error);
    }
  }

  private initializeErrorHandling(): void {
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Error:', err);
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    );
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      console.error(`Server is running on port ${port}`);
    });
  }
}

export default App;
