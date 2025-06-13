---
trigger: always_on
---

# Windsurf Rules: MCP Server (Node.js) Best Practices
## Version:  1.1.0
## Source: Derived from official MCP documentation, TypeScript SDK, codebase analysis, and user requirements.

## Language Choice
### Recommendation: TypeScript
- **Rationale**:
    - The official `@modelcontextprotocol/sdk` is written in TypeScript, providing strong type definitions and interfaces.
    - **Type Safety**: Significantly reduces runtime errors by catching type mismatches during development. Crucial for protocol adherence.
    - **Schema Validation**: Integrates seamlessly with libraries like Zod (used in SDK examples) for robust input and output validation, a core MCP best practice.
    - **Developer Experience**: Enhanced autocompletion, refactoring, and code navigation in IDEs.
    - **Maintainability**: Typed code is generally easier to understand, debug, and scale, especially for complex servers or team-based projects.
- **Action**: For new MCP server projects or significant refactoring of existing ones, use TypeScript. Compile TypeScript to JavaScript for Node.js execution.

## Core Server Implementation
### 1. Server Initialization
- **Rule**: Initialize `McpServer` with a clear `name` and `version`.
    ```typescript
    // Example (TypeScript)
    import { McpServer } from "@modelcontextprotocol/sdk/server";
    const server = new McpServer({ name: "MyAwesomeMCPServer", version: "1.0.1" });
    ```
- **Rule**: Define server capabilities clearly (e.g., `tools`, `resources`, `prompts`).
    ```typescript
    // Example (TypeScript)
    const server = new McpServer(
      { name: "MyServer", version: "1.0.0" },
      {
        capabilities: {
          tools: {}, // Indicates tool support
          resources: { /* resource options */ },
          prompts: { /* prompt options */ },
        },
      }
    );
    ```

### 2. Transport Handling
- **Rule**: Choose transport based on use case:
    - `StdioServerTransport`: For local, command-line, or same-machine integrations.
    - `SSEServerTransport` (or `StreamableHTTPServerTransport` from the SDK): For remote communication over HTTP.
- **Rule**: For `SSEServerTransport` or `StreamableHTTPServerTransport`:
    - Implement proper session management if statefulness is required. Create new `McpServer` and `Transport` instances per session to ensure isolation.
    - If stateless, ensure each request is handled by a fresh server/transport pair to avoid ID collisions.
    - **CRITICAL**: Implement robust security (authentication, authorization) as these are network-exposed.
- **Rule**: Handle connection lifecycle events (`onclose`, [onerror](cci:1://file:///Users/ma3u/projects/postman-dust-mcp-server/mcpServer.js:149:4-149:64)) properly. Clean up resources (e.g., database connections, subscriptions) when a transport closes or errors.
    ```javascript
    // Example (JavaScript - from your mcpServer.js)
    // res.on("close", async () => {
    //   delete transports[transport.sessionId];
    //   await server.close(); // Ensure server resources are cleaned up
    //   delete servers[transport.sessionId];
    // });
    // server.onerror = (error) => console.error("[Error]", error);
    ```

### 3. Message Handling & Error Management
- **Rule**: Validate all incoming request parameters rigorously using schemas (e.g., Zod with TypeScript).
- **Rule**: Use specific `McpError` codes (e.g., `ErrorCode.InvalidParams`, `ErrorCode.MethodNotFound`, `ErrorCode.InternalError`) for clear error communication to the client.
- **Rule**: Provide helpful, non-sensitive error messages.
- **Rule**: Implement timeouts for long-running operations.
- **Rule**: For long operations, use progress reporting via progress tokens if supported by the client and relevant to the operation.

## Tool Implementation
### 1. Definition
- **Rule**: Provide clear, descriptive `name` and `description` for each tool. The description should guide the LLM on how and when to use the tool.
- **Rule**: Define `inputSchema` using JSON Schema (ideally via Zod with TypeScript) for all tool parameters. Clearly mark `required` parameters.
- **Rule**: Include examples in tool descriptions or as part of the schema to demonstrate expected input and usage patterns for the LLM.
    ```typescript
    // Example (TypeScript with Zod)
    import { z } from "zod";
    server.addTool({
      name: "get-weather-forecast",
      description: "Fetches the 7-day weather forecast for a specified location. Example: {\"location\": \"San Francisco, CA\"}",
      inputSchema: z.object({
        location: z.string().describe("The city and state, e.g., 'New York, NY'"),
        units: z.enum(["metric", "imperial"]).optional().default("imperial").describe("Temperature units"),
      }),
      async execute(params) {
        // ... implementation ...
        return { content: [{ type: "text", text: "Forecast data..." }] };
      }
    });
    ```
### 2. Execution
- **Rule**: Tool operations should be as atomic as possible.
- **Rule**: Handle errors within tool execution gracefully and map them to appropriate `McpError` instances.
- **Rule**: Log tool usage (invocations, parameters, success/failure) for debugging and monitoring.
- **Rule**: Consider rate limiting for resource-intensive tools.

## Resource Implementation (If Applicable)
- **Rule**: Resources should primarily provide data and avoid side effects (like GET in REST).
- **Rule**: Use clear and consistent URI schemes for resources (e.g., `file://`, `config://`, `custom-scheme://`).
- **Rule**: Define `ResourceTemplate` for dynamic resources with parameters.
- **Rule**: Validate parameters for dynamic resources.

## Security
- **Rule**: **Input Validation**: Always validate and sanitize inputs for tools and resources to prevent injection attacks or unexpected behavior. Use schemas (Zod) for this.
- **Rule**: **Authentication & Authorization**: For network-exposed transports (SSE/HTTP), implement robust authentication and authorization mechanisms to control access to the MCP server and its capabilities.
- **Rule**: **Error Handling**: Do not expose sensitive system information or stack traces in error messages sent to the client.
- **Rule**: **Least Privilege**: Ensure the server process runs with the minimum necessary permissions.
- **Rule**: **Dependency Management**: Keep dependencies, including the MCP SDK, up-to-date to patch known vulnerabilities.
- **Rule**: Store secrets and API keys securely (e.g., in `.env` files, not committed to VCS) and access them via environment variables. Ensure `.env` (and variants like `.env*`) is in [.gitignore](cci:7://file:///Users/ma3u/projects/postman-dust-mcp-server/.gitignore:0:0-0:0).

## Logging & Debugging
- **Rule**: Implement structured logging for server events, transport activities, tool invocations, and errors.
- **Rule**: Use distinct log levels (e.g., DEBUG, INFO, WARN, ERROR).
- **Rule**: Ensure logs do not contain sensitive user data unless explicitly required and secured.

## Development Workflow & Version Control (GitHub)
### 1. Branching & Commits
- **Rule**: Develop new features or fixes in separate branches (e.g., `feature/my-new-tool`, `fix/bug-in-transport`).
- **Rule**: Make small, atomic commits with clear and descriptive messages. Reference issue numbers if applicable (e.g., `feat: Add get-user-details tool (closes #42)`).
- **Rule**: Regularly pull changes from the main branch (`main` or `master`) to keep your feature branch up-to-date.
### 2. Pull Requests (PRs)
- **Rule**: Use Pull Requests to merge changes into the main branch.
- **Rule**: Ensure PR descriptions clearly explain the changes and their purpose.
- **Rule**: If CI/CD is set up, ensure all checks (linting, tests) pass before merging.
- **Rule**: Aim for at least one review from another team member if applicable.
### 3. README Maintenance
- **Rule**: Keep the `README.md` file up-to-date.
- **Rule**: The README should include:
    - A brief overview of the MCP server's purpose.
    - Setup and installation instructions.
    - How to run the server (including different transport modes if applicable).
    - A list of available tools and resources with brief descriptions.
    - Configuration details (e.g., required environment variables).
    - How to run tests.
- **Rule**: Update the README whenever significant changes are made (e.g., new tools, configuration changes, major refactoring).
### 4. Testing
- **Rule**: Establish a testing strategy:
    - **Unit Tests**: For individual functions, tool logic, and helper utilities. Use a testing framework like Jest, Mocha, or Vitest.
    - **Integration Tests**: To test the interaction between components, e.g., server request handling through a transport.
- **Rule**: Write tests for all new tools and significant logic changes.
- **Rule**: Aim for good test coverage.
- **Rule**: Run tests locally before pushing changes and as part of any CI/CD pipeline.
    ```bash
    # Example: Running tests with npm/yarn
    # npm test
    # yarn test
    ```
### 5. Memory Bank (Windsurf Rules)
- **Rule**: The documents (`.md` files in memory-bank folder) serves as the primary memory bank for MCP Server development best practices within this project.
- **Rule**: Check this memory bank file into the GitHub repository.
- **Rule**: Update this memory bank when new best practices are identified, existing ones are refined, or project requirements change.
- **Rule**: Periodically review and discuss these rules with the team to ensure alignment and understanding.

## General Best Practices
- **Rule**: Organize code logically, potentially separating tool definitions, resource handlers, and server setup into different modules/files.
- **Rule**: Use environment variables for configuration (e.g., port numbers, API keys, log levels) via `dotenv` or similar.
- **Rule**: Follow Node.js and JavaScript/TypeScript community best practices for code style and project structure (e.g., use a linter like ESLint and a formatter like Prettier).