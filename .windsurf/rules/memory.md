---
trigger: always_on
---

# Windsurf Rules: Memory Bank

**Version:** 1.1.0  
*This section configures Cascade to use a file-based memory system.*

## Memory System Rules

### Primary System
- **Name:** file-based-memory-bank
- **Restrictions:**
  - Use ONLY this memory-bank system defined here

### Rationale
This project maintains a clear separation between its memory-bank system and any built-in memories. This separation is crucial for proper operation and must be strictly maintained. This file-based memory-bank system provides all necessary persistence and will be managed and versioned by GitHub.

### Secondary System
- **Status:** none

### Excluded Systems
- **Name:** built-in-memories
- **Tool:** create_memory
- **Reason:** Project uses dedicated memory-bank system
- **Override:** Only with explicit user request

### Enforcement
- NEVER use create_memory tool for project context
- ALL persistent information must use memory-bank files
- Ignore built-in memory system completely

## Memory Bank Strategy

### Initialization
1. **CHECK FOR MEMORY BANK:**
   - First, check if the memory-bank/ directory exists
   - Verify the structure matches the expected format
   - Check for any required files (activeContext.md, decisionLog.md, etc.)
   
   ```
   memory-bank/
   ├── projectContext.md
   ├── activeContext.md
   ├── progress.md
   ├── decisionLog.md
   └── systemPatterns.md
   ```

2. **If No Memory Bank Found:**
   - Inform the user: "No Memory Bank was found. I recommend creating one to maintain project context."
   - Offer to initialize the Memory Bank
   - If user agrees, create the `memory-bank/` directory and its core files
   - If user declines, proceed without Memory Bank functionality

3. **If Memory Bank Exists:**
   - Validate structure to ensure all required files are present
   - Read the contents of the memory bank files to establish project context
   - Inform the user that the Memory Bank is active