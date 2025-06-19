"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceConfig = getWorkspaceConfig;
exports.getDefaultWorkspaceId = getDefaultWorkspaceId;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getWorkspaceConfig(workspaceId) {
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
function getDefaultWorkspaceId() {
    return process.env.DEFAULT_WORKSPACE_ID || 'default';
}
//# sourceMappingURL=workspace.js.map