/**
 * Handles streaming responses from the Dust API.
 * Manages event streams and forwards chunks to session listeners.
 */
export class StreamingHandler {
  /**
   * @param {Object} sessionManager - Instance of SessionManager
   */
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.baseUrl = 'https://dust.tt';
  }

  /**
   * Streams a response from the Dust API
   * @param {string} sessionId - The session ID
   * @param {string} message - The message to send
   * @returns {AsyncGenerator<Object>} Yields response chunks
   */
  async *streamResponse(sessionId, message) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    const { workspaceId, conversationId } = session;
    const url = conversationId 
      ? `${this.baseUrl}/api/conversations/${conversationId}/messages`
      : `${this.baseUrl}/api/conversations`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DUST_API_KEY}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message,
          agentId: session.agentId,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to stream response');
      }

      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              // Update session with conversation ID if this is the first message
              if (data.conversationId && !session.conversationId) {
                this.sessionManager.setConversationId(sessionId, data.conversationId);
              }
              
              // Notify all listeners
              for (const listener of session.listeners) {
                try {
                  listener(data);
                } catch (error) {
                  console.error('[StreamingHandler] Error in listener:', error);
                }
              }
              
              // Yield the data to the generator
              yield data;
            } catch (error) {
              console.error('[StreamingHandler] Error parsing chunk:', error);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('[StreamingHandler] Stream error:', error);
      throw error;
    }
  }
}
