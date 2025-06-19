"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDiscoveryService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const CACHE_TTL = 300;
const agentCache = new node_cache_1.default({ stdTTL: CACHE_TTL });
class AgentDiscoveryService {
    static instance;
    cache = agentCache;
    constructor() { }
    static getInstance() {
        if (!AgentDiscoveryService.instance) {
            AgentDiscoveryService.instance = new AgentDiscoveryService();
        }
        return AgentDiscoveryService.instance;
    }
    getCacheKey(workspaceId) {
        return `agents:${workspaceId}`;
    }
    async getAgentConfigurations(workspaceConfig, forceRefresh = false) {
        const cacheKey = this.getCacheKey(workspaceConfig.id);
        if (!forceRefresh) {
            const cachedAgents = this.cache.get(cacheKey);
            if (cachedAgents) {
                return cachedAgents;
            }
        }
        try {
            const agents = [
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
            this.cache.set(cacheKey, agents);
            return agents;
        }
        catch (error) {
            console.error('Error fetching agent configurations:', error);
            throw new Error('Failed to fetch agent configurations');
        }
    }
    async getAgent(workspaceConfig, agentId) {
        const agents = await this.getAgentConfigurations(workspaceConfig);
        return agents.find((agent) => agent.id === agentId);
    }
    clearCache(workspaceId) {
        if (workspaceId) {
            this.cache.del(this.getCacheKey(workspaceId));
        }
        else {
            this.cache.flushAll();
        }
    }
}
exports.AgentDiscoveryService = AgentDiscoveryService;
//# sourceMappingURL=agentDiscovery.js.map