# Project Context: postman-dust-mcp-server

This document provides a high-level overview of the `postman-dust-mcp-server` project.

## 1. Core Purpose

The primary goal of this project is to create a robust and scalable Model Context Protocol (MCP) server. This server acts as a bridge between an AI model (like Cascade) and external tools and services, specifically integrating with Postman and Dust.

## 2. Key Components

*   **`mcpServer.js`**: The main entry point and core logic for the MCP server. It handles server initialization, transport setup, and tool registration.
*   **`package.json`**: Defines project dependencies, including the `@modelcontextprotocol/sdk`.
*   **`.windsurfrules`**: Contains project-specific rules and best practices for the AI agent.
*   **`memory-bank/`**: A file-based system for persisting project knowledge, decisions, and context, designed for version control.

## 3. Technical Goals

*   **Statelessness**: Ensure each client session is isolated by creating new server and transport instances per connection.
*   **Extensibility**: Design the server to easily accommodate new tools and capabilities.
*   **Adherence to MCP Best Practices**: Follow the guidelines defined in the project's memory bank and `.windsurfrules`, such as using TypeScript for new development and implementing robust error handling.

## 4. Current Status

The project has a basic MCP server setup. A file-based memory bank has been initialized to track project context and decisions.

*Last Updated: 2025-06-13*
