# CONVENTIONS.md - APPCONTAGEM

# TYPESCRIPT
- Strict mode mandatory
- Avoid any
- Prefer explicit types

# REACT NATIVE
- Avoid inline functions in large lists
- Memoize expensive components
- Keep screens lightweight

# RTK QUERY
- Use tag invalidation
- Avoid manual refetch patterns

# PRISMA
- Avoid N+1 queries
- Prefer select/include optimization
- Sempre usar transactions em operações críticas (movimentações, contagem)

# BACKEND
- Estrutura: `modules/<nome>/<nome>.routes.ts`, `.controller.ts`, `.service.ts`
- JSON responses only
- Erros passam obrigatoriamente pelo middleware `errorHandler`

# NOMENCLATURA
- Pastas: kebab-case ou PascalCase (telas)
- Arquivos: PascalCase para componentes/telas
- Funções: camelCase
- Constantes: UPPER_SNAKE_CASE

# COMMITS
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`
