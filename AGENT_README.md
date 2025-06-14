# Dust Agent MCP Server

This MCP (Model Context Protocol) server enables interaction with Dust agents through a standardized interface. It supports listing available agents, creating conversations, and streaming responses.

## Prerequisites

- Node.js 16 or later
- Dust API key
- Dust Workspace ID

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your credentials:
   ```env
   DUST_API_KEY=your_api_key_here
   DUST_WORKSPACE_ID=your_workspace_id_here
   PORT=3001  # Optional, defaults to 3001
   ```

## Running the Server

### Development Mode (STDIO)
For local development and testing:
```bash
node mcpServer.js
```

### Production Mode (SSE)
For production use with HTTP/SSE:
```bash
node mcpServer.js --sse
```

The server will be available at `http://localhost:3001` (or your specified PORT).

## Available Tools

The server provides the following tools:

### 1. List Agents
List all available agents in the workspace.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "list_agents",
    "arguments": {}
  }
}
```

### 2. Create Conversation
Start a new conversation with an agent.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "callTool",
  "params": {
    "name": "create_conversation",
    "arguments": {
      "agentId": "agent_id_here",
      "message": "Hello, agent!"
    }
  }
}
```

### 3. Send Message
Send a message in an existing conversation.

**Request (Standard):**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "callTool",
  "params": {
    "name": "send_message",
    "arguments": {
      "sessionId": "session_id_here",
      "message": "Your message here"
    }
  }
}
```

**Request (Streaming):**
```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "callTool",
  "params": {
    "name": "send_message",
    "arguments": {
      "sessionId": "session_id_here",
      "message": "Your message here",
      "stream": true
    }
  }
}
```

## Testing with the Interactive Client

An interactive test client is provided to test the agent functionality:

1. Start the MCP server in SSE mode:
   ```bash
   node mcpServer.js --sse
   ```

2. In a new terminal, run the test client:
   ```bash
   node test-agent.js
   ```

3. Follow the prompts to select an agent and start chatting.

## Session Management

- Sessions automatically expire after 1 hour of inactivity
- Each session maintains conversation state with the agent
- The session ID is returned when creating a conversation and must be used for subsequent messages

## Error Handling

- Invalid requests return appropriate JSON-RPC error codes
- Detailed error messages are provided in the response
- Network errors and timeouts are handled gracefully

## Security Considerations

- Always keep your `DUST_API_KEY` secret
- Use HTTPS in production
- The server validates all input parameters
- Sensitive information is not logged

## License

MIT
