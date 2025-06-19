import { Application } from 'express';
declare class App {
    app: Application;
    private agentDiscovery;
    constructor();
    private initializeMiddlewares;
    private initializeRoutes;
    private handleWorkspaceRequest;
    private getAgentConfigurations;
    private getAgent;
    private initializeErrorHandling;
    start(port: number): void;
}
export default App;
//# sourceMappingURL=app.d.ts.map