"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const workspace_1 = require("./config/workspace");
const agentDiscovery_1 = require("./services/agentDiscovery");
class App {
    app;
    agentDiscovery;
    constructor() {
        this.app = (0, express_1.default)();
        this.agentDiscovery = agentDiscovery_1.AgentDiscoveryService.getInstance();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }
    initializeMiddlewares() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
    }
    initializeRoutes() {
        this.app.get('/health', (_req, res) => {
            res.status(200).json({ status: 'ok' });
        });
        this.app.get('/api/workspaces/:workspaceId/agents', this.handleWorkspaceRequest.bind(this), this.getAgentConfigurations.bind(this));
        this.app.get('/api/workspaces/:workspaceId/agents/:agentId', this.handleWorkspaceRequest.bind(this), this.getAgent.bind(this));
    }
    async handleWorkspaceRequest(req, _res, next) {
        try {
            const workspaceId = req.params.workspaceId || (0, workspace_1.getDefaultWorkspaceId)();
            const workspaceConfig = (0, workspace_1.getWorkspaceConfig)(workspaceId);
            req.workspaceConfig = workspaceConfig;
            next();
        }
        catch (error) {
            next(error);
        }
    }
    async getAgentConfigurations(req, res, next) {
        try {
            const forceRefresh = req.query.forceRefresh === 'true';
            const agents = await this.agentDiscovery.getAgentConfigurations(req.workspaceConfig, forceRefresh);
            res.json({ agents });
        }
        catch (error) {
            next(error);
        }
    }
    async getAgent(req, res, next) {
        try {
            const { agentId } = req.params;
            if (!agentId) {
                res.status(400).json({ error: 'Agent ID is required' });
                return;
            }
            const agent = await this.agentDiscovery.getAgent(req.workspaceConfig, agentId);
            if (!agent) {
                res.status(404).json({ error: 'Agent not found' });
                return;
            }
            res.json(agent);
        }
        catch (error) {
            next(error);
        }
    }
    initializeErrorHandling() {
        this.app.use((err, _req, res, _next) => {
            console.error('Error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        });
    }
    start(port) {
        this.app.listen(port, () => {
            console.error(`Server is running on port ${port}`);
        });
    }
}
exports.default = App;
//# sourceMappingURL=app.js.map