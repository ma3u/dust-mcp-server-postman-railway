# System Patterns & MCP Best Practices

This file documents recurring patterns, standards, and links to official Model Context Protocol (MCP) documentation.

Last Updated: 2025-06-13

---

## Official MCP Documentation

* **[Main Documentation Portal](https://modelcontextprotocol.io/introduction)**: The primary source for understanding the protocol, its components, and core concepts.
* **[GitHub Organization](https://github.com/modelcontextprotocol)**: Home to the official MCP repositories, including the SDK, specification, and example implementations.
* **[Documentation Source Code](https://github.com/modelcontextprotocol/docs)**: The repository for the official documentation. Useful for seeing the raw markdown and structure.

---

## Project Architectural Patterns

(This section is for documenting architectural decisions and patterns specific to this project.)

* **Session Management**: Implement a stateless approach by creating a new `McpServer` and `Transport` instance for each client connection. This prevents ID collisions and ensures session isolation, as seen in `mcpServer.js`.
* **Tool Modularity**: Define tools in a modular way, so they can be easily added, removed, or modified without impacting the core server logic.

---

## Project Coding Patterns

(This section is for documenting code-level conventions and best practices.)

* **TypeScript First**: For all new development, use TypeScript to leverage the type safety and interfaces provided by the `@modelcontextprotocol/sdk`.
* **Schema Validation**: Use a library like Zod to rigorously validate the `inputSchema` for all tools. This is a critical security and reliability practice.
* **Error Handling**: Use the specific `McpError` codes (e.g., `ErrorCode.InvalidParams`) to provide clear and standardized error feedback to the client.
