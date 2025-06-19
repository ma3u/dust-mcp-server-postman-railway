## Updated Agent Conversation Flow Diagram

I've updated the Mermaid diagram to better reflect our actual implementation. Here's the improved version:

```mermaid
sequenceDiagram
    participant User
    participant MCPClient as MCP Client
    participant MCPServer as MCP Server
    participant SessionMgr as Session Manager
    participant ConvMgr as Conversation Manager
    participant Dust as Dust Service

    %% Session Initialization
    User->>MCPClient: Start New Session
    MCPClient->>MCPServer: POST /api/sessions
    MCPServer->>SessionMgr: createSession()
    SessionMgr-->>MCPServer: {sessionId, status: 'active'}
    MCPServer->>ConvMgr: new Conversation(sessionId)
    ConvMgr-->>MCPServer: {conversationId, state: 'initializing'}
    MCPServer-->>MCPClient: {sessionId, conversationId, status: 'active'}
    MCPClient-->>User: Session Ready

    %% Message Flow
    loop While Session Active
        User->>MCPClient: Send Message
        MCPClient->>MCPServer: POST /api/conversations/{conversationId}/messages
        MCPServer->>ConvMgr: processMessage(message)
        alt Has Files
            ConvMgr->>FileUploadHandler: handleUpload(files)
            FileUploadHandler-->>ConvMgr: {fileIds, paths}
        end
        ConvMgr->>Dust: forwardMessage(conversationId, message, files)
        Dust-->>ConvMgr: {response, metadata}
        ConvMgr->>ConversationHistory: addMessage(message, response)
        MCPServer-->>MCPClient: {response, state, metadata}
        MCPClient-->>User: Display Response
        
        %% Timeout Handling
        alt Idle Timeout Reached
            ConvMgr->>ConvMgr: handleIdleTimeout()
            ConvMgr->>SessionMgr: updateSession(sessionId, {state: 'idle'})
            SessionMgr-->>ConvMgr: {status: 'updated'}
            ConvMgr-->>MCPServer: {event: 'stateChange', state: 'idle'}
            MCPServer-->>MCPClient: {event: 'sessionIdle'}
        end
    end

    %% Session Termination
    User->>MCPClient: End Session
    MCPClient->>MCPServer: DELETE /api/sessions/{sessionId}
    MCPServer->>SessionMgr: deleteSession(sessionId)
    SessionMgr->>ConvMgr: destroy()
    ConvMgr->>ConversationHistory: clear()
    ConvMgr-->>SessionMgr: {status: 'destroyed'}
    SessionMgr-->>MCPServer: {status: 'deleted'}
    MCPServer-->>MCPClient: {status: 'session_ended'}
    MCPClient-->>User: Session Ended
```

### Key Improvements:
1. Added explicit `SessionManager` and `ConversationManager` participants
2. Included actual REST endpoints used in the implementation
3. Added file upload handling flow
4. Included conversation state management and timeouts
5. Added proper session cleanup flow
6. Included event emission for state changes

This diagram now accurately reflects our implementation in `ConversationManager.js` and related files.
