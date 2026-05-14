# APPCONTAGEM — AI INSTRUCTIONS

# EXECUTION PRIORITY
1. Correctness
2. Minimal changes
3. Performance
4. Maintainability
5. Conciseness

# CORE RULES
- Minimal diffs only
- Never rewrite entire files
- Preserve existing architecture
- Prefer concise responses
- Return only changed code when possible
- Avoid unrelated refactors
- Request only necessary files
- Use Sonnet by default
- Use Opus only for architecture/refactors

# CONTEXT HIERARCHY
Priority order:
1. Current task
2. Current files
3. Related module
4. MEMORY.md
5. CONVENTIONS.md
6. CLAUDE.md

Load additional context only if necessary.

# OUTPUT RULES
- Prefer patch/diff responses
- Avoid full file rewrites
- Avoid long explanations
- Max 5-line reasoning
- Do not repeat unchanged code
- Keep outputs compact

# MODULE ISOLATION
Treat modules independently unless explicitly requested.
Avoid cross-module refactors.
Avoid scanning unrelated folders.

# SESSION PROTECTION
At ~50-60% context:
1. Compact conversation
2. Update MEMORY.md
3. Start new chat

# FILE ACCESS POLICY
- Request only relevant files
- Avoid loading entire folders
- Avoid unrelated context expansion
