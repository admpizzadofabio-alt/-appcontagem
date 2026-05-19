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

# ===================================================================
# 🤖 ROUTER AUTÔNOMO v3.1 — INJEÇÃO DE CONTEXTO AUTOMÁTICA
# ===================================================================
# Você DEVE usar suas ferramentas para ler os arquivos abaixo autonomamente.
# O usuário NÃO precisa usar o `@`.

# 1. SEMPRE QUE INICIAR UM CHAT: Leia `memory/MEMORY_ACTIVE.md`
# 2. SE FOR BUG: Leia `memory/ERROR_DNA.md` + `memory/STATE_SNAPSHOT.md`
# 3. SE FOR CRIAR/REFATORAR: Leia `CONVENTIONS.md` + `core/BUSINESS_RULES.md`
# 4. SE PRECISAR LOCALIZAR MÓDULO: Consulte `memory/SEMANTIC_INDEX.md`

# SELF-CRITIQUE PROTOCOL
- Você **DEVE** revisar seu plano contra `CONVENTIONS.md` e `core/BUSINESS_RULES.md` antes de responder.

# TOKEN EFFICIENCY RULES (ANTI-REPETITION ENGINE)
- Nunca repetir explicações já aprovadas.
- Nunca reexplicar arquitetura conhecida.
- Responder incrementalmente.
- Preferir diffs ao invés de blocos completos.
- Nunca regenerar arquivos inteiros sem necessidade.
