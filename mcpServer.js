#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";
import { agentTools } from "./tools/agent/agentTools.js";
import { SessionManager } from "./lib/sessionManager.js";
import { createFileRoutes } from "./routes/fileRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const SERVER_NAME = "dust-mcp-agent-server";
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Initialize session manager
const sessionManager = new SessionManager({
  uploadDir: UPLOAD_DIR,
  maxFileSize: MAX_FILE_SIZE
});

// Validate required environment variables
const REQUIRED_ENV = ['DUST_API_KEY', 'DUST_WORKSPACE_ID'];
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    console.error(`[MCP Server] Error: Missing required environment variable ${envVar}`);
    process.exit(1);
  }
}

async function transformTools(tools) {
  return tools
    .map((tool) => {
      const definitionFunction = tool.definition?.function;
      if (!definitionFunction) return;
      return {
        name: definitionFunction.name,
        description: definitionFunction.description,
        inputSchema: definitionFunction.parameters,
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  // Add agent tools to the list of available tools
  const allTools = [...tools, ...agentTools];
  
  // Helper to log tool calls
  function logToolCall(toolName, args) {
    const argsStr = JSON.stringify(args, (key, value) => 
      key === 'apiKey' || key === 'DUST_API_KEY' ? '***' : value
    );
    console.error(`[MCP Server] Tool call: ${toolName} with args: ${argsStr}`);
  }

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(allTools),
  }));

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = allTools.find((t) => t.definition.function.name === toolName);
    
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    
    logToolCall(toolName, request.params.arguments);
    
    // Handle streaming responses
    if (request.params.arguments.stream === true && tool.function.constructor.name === 'AsyncGeneratorFunction') {
      return {
        stream: true,
        async *execute() {
          try {
            for await (const chunk of await tool.function(request.params.arguments)) {
              yield {
                content: [{
                  type: 'text',
                  text: JSON.stringify(chunk)
                }]
              };
            }
          } catch (error) {
            console.error(`[MCP Server] Error in streaming response for ${toolName}:`, error);
            throw new McpError(ErrorCode.InternalError, `Streaming error: ${error.message}`);
          }
        }
      };
    }
    const args = request.params.arguments;
    const requiredParameters =
      tool.definition?.function?.parameters?.required || [];
    for (const requiredParameter of requiredParameters) {
      if (!(requiredParameter in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${requiredParameter}`
        );
      }
    }
    try {
      const result = await tool.function(request.params.arguments);
      
      // Handle streamable response
      if (result && result.stream === true) {
        return {
          stream: true,
          async *execute() {
            try {
              for await (const chunk of result.generator) {
                yield {
                  content: [{
                    type: 'text',
                    text: JSON.stringify(chunk)
                  }]
                };
              }
            } catch (error) {
              console.error(`[MCP Server] Error in streaming response for ${toolName}:`, error);
              throw new McpError(ErrorCode.InternalError, `Streaming error: ${error.message}`);
            }
          }
        };
      }
      
      // Regular response
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error(`[MCP Server] Error in tool ${toolName}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `${toolName} error: ${error.message}`
      );
    }
  });
}

async function run() {
  console.error('[MCP Server] Starting server...');
  let tools = [];
  let isSSE = false;
  
  try {
    const args = process.argv.slice(2);
    isSSE = args.includes("--sse");
    
    console.error('[MCP Server] Discovering tools...');
    tools = await discoverTools();
    console.error(`[MCP Server] Discovered ${tools.length} tools`);
    
    // Log available tool names for debugging
    console.error('[MCP Server] Available tools:', tools.map(t => t.definition?.function?.name).filter(Boolean));
  } catch (error) {
    console.error('[MCP Server] Error during initialization:', error);
    process.exit(1);
  }

  if (isSSE) {
    const app = express();
    const transports = {};
    const servers = {};

    app.get("/sse", async (_req, res) => {
      // Create a new Server instance for each session
      const server = new Server(
        {
          name: SERVER_NAME,
          version: "0.1.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      server.onerror = (error) => console.error("[Error]", error);
      await setupServerHandlers(server, tools);

      let newSession;
      try {
        newSession = await sessionManager.createSession(); // Use the global sessionManager
        res.setHeader('Mcp-Session-Id', newSession.id);
        console.error(`[MCP Server] Session created: ${newSession.id}, Mcp-Session-Id header sent.`);
      } catch (error) {
        console.error(`[MCP Server] Error creating session:`, error);
        if (!res.headersSent) {
          res.status(500).send("Error initializing session");
        }
        return;
      }

      const mcpSessionId = newSession.id; // Our Mcp-Session-Id

      const transport = new SSEServerTransport("/messages", res);
      transports[mcpSessionId] = transport; // Key by our Mcp-Session-Id
      servers[mcpSessionId] = server;       // Key by our Mcp-Session-Id

      res.on("close", async () => {
        delete transports[mcpSessionId];
        delete servers[mcpSessionId];
        // Note: SessionManager's TTL will handle cleanup of mcpSessionId unless explicit deletion is added.
        await server.close(); // Close the specific server instance for this session
        console.error(`[MCP Server] SSE connection closed for Mcp-Session-Id: ${mcpSessionId}`);
      });

      await server.connect(transport);
    });

    // MCP Message Handler for SSE
    app.post("/messages", async (req, res) => {
      const mcpSessionId = req.headers['mcp-session-id'];
      if (!mcpSessionId) {
        console.error('[MCP Server] /messages: Mcp-Session-Id header missing');
        return res.status(400).send("Mcp-Session-Id header missing");
      }

      const appSession = await sessionManager.getSession(mcpSessionId);
      if (!appSession) {
        console.error(`[MCP Server] /messages: Session not found in SessionManager for Mcp-Session-Id: ${mcpSessionId}`);
        return res.status(404).send("Session not found or expired");
      }

      const transport = transports[mcpSessionId];
      const server = servers[mcpSessionId];

      if (transport && server) {
        console.error(`[MCP Server] /messages: Handling POST for Mcp-Session-Id: ${mcpSessionId}`);
        await transport.handlePostMessage(req, res);
      } else {
        // This case should ideally not be hit if sessionManager found a session
        // and our Mcp-Session-Id is the key for transports/servers map.
        // Could indicate an inconsistency if Mcp-Session-Id exists in sessionManager but not in transports/servers map.
        console.error(`[MCP Server] /messages: No transport/server found for Mcp-Session-Id: ${mcpSessionId}, though session exists in SessionManager.`);
        res.status(500).send("Internal server error: transport/server mismatch");
      }
    });

    // MCP Client-Initiated Session Termination for SSE
    app.delete("/sse", async (req, res) => {
      const mcpSessionId = req.headers['mcp-session-id'];
      if (!mcpSessionId) {
        console.error('[MCP Server] DELETE /sse: Mcp-Session-Id header missing');
        return res.status(400).send("Mcp-Session-Id header missing");
      }

      try {
        const sessionExists = await sessionManager.getSession(mcpSessionId);
        if (!sessionExists) {
          console.error(`[MCP Server] DELETE /sse: Session not found for Mcp-Session-Id: ${mcpSessionId}`);
          return res.status(404).send("Session not found or already terminated");
        }

        await sessionManager.deleteSession(mcpSessionId);
        // Also clean up transport and server instances associated with this session
        const transport = transports[mcpSessionId];
        if (transport) {
          // SSEServerTransport doesn't have an explicit close/destroy method for the client-facing connection itself,
          // but we should ensure its resources are freed.
          // The actual SSE connection would be closed by the client or network, or res.end() if we send a response.
          delete transports[mcpSessionId];
        }
        const serverInstance = servers[mcpSessionId];
        if (serverInstance) {
          await serverInstance.close(); // Close the MCP Server instance
          delete servers[mcpSessionId];
        }
        console.error(`[MCP Server] DELETE /sse: Session terminated successfully for Mcp-Session-Id: ${mcpSessionId}`);
        res.status(200).send("Session terminated");
      } catch (error) {
        console.error(`[MCP Server] DELETE /sse: Error terminating session ${mcpSessionId}:`, error);
        res.status(500).send("Error terminating session");
      }
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.error(`[SSE Server] running on port ${port}`);
    });
  } else {
    const tools = await discoverTools();
    const transformedTools = await transformTools(tools);

    // Create Express app for HTTP endpoints
    const app = express();
    
    // Enable CORS for all routes
    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    // File upload routes
    const fileRouter = createFileRoutes({ sessionManager });
    app.use('/api', fileRouter);
    
    // Create MCP server
    const server = new Server(
      { name: SERVER_NAME, version: "1.0.0" },
      {
        capabilities: {
          tools: {},
        },
      },
    );
    
    // Store server instance for cleanup
    let httpServer;
    
    // Start HTTP server if not in stdio mode
    if (process.env.NODE_ENV !== 'test') {
      const PORT = process.env.PORT || 3001;
      httpServer = app.listen(PORT, '0.0.0.0', () => {
        console.error(`[${SERVER_NAME}] HTTP server running on port ${PORT}`);
        console.error(`[${SERVER_NAME}] File upload endpoint: http://localhost:${PORT}/api/sessions/:sessionId/files`);
      });
    }

    server.onerror = (error) => console.error("[Error]", error);
    await setupServerHandlers(server, tools);

    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });

    console.error('[MCP Server] Starting in stdio mode...');
    const transport = new StdioServerTransport();
    
    // Handle process signals for clean shutdown
    process.on('SIGINT', async () => {
      console.error('[MCP Server] Shutting down...');
      await server.close();
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[MCP Server] Uncaught exception:', error);
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[MCP Server] Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
    console.error('[MCP Server] Connecting server to transport...');
    try {
      await server.connect(transport);
      console.error('[MCP Server] Server connected and ready');
      console.error('[MCP Server] Send a JSON-RPC message to interact with the server');
      
      // Keep the process alive by preventing Node.js from exiting
      // This is important for STDIO transport to maintain the connection
      const keepAlive = setInterval(() => {
        // This keeps the event loop busy
        if (process.stdout.writable) {
          process.stdout.write('\0'); // Null byte to keep the connection alive
        }
      }, 30000); // Every 30 seconds
      
      // Clean up the interval on process exit
      process.on('exit', () => {
        clearInterval(keepAlive);
      });
      
      // Log when the server is about to close
      if (typeof server.on === 'function') {
        server.on('close', () => {
          console.error('[MCP Server] Server is shutting down...');
          clearInterval(keepAlive);
        });
      } else {
        // If server doesn't support 'on' method, use process exit handler
        process.on('beforeExit', () => {
          console.error('[MCP Server] Server is shutting down...');
          clearInterval(keepAlive);
        });
      }
      
    } catch (error) {
      console.error('[MCP Server] Failed to connect to transport:', error);
      process.exit(1);
    }
  }
}

run().catch(console.error);
