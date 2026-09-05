# CodeSentry — instruções para o Claude Code

1. **Antes de fazer qualquer alteração neste repositório**, leia por
   completo [docs/architecture.md](docs/architecture.md). Ele define a
   estrutura de pastas, a responsabilidade de cada módulo e o fluxo de
   dados `command → scanner → rules → reporter`. Não crie pastas de
   topo nem reestruture o projeto de forma divergente sem confirmação
   explícita do usuário.

2. **TDD é obrigatório** para qualquer mudança: escreva primeiro um
   teste em `tests/` que falhe (red), confirme que ele falha, e só
   então implemente o mínimo de código para fazê-lo passar (green).
   Nunca escreva código de implementação novo sem um teste
   correspondente já existir. Use `src/rules/no-eval.rule.ts` e
   `tests/rules/no-eval.rule.spec.ts` como referência do padrão.

3. A stack de bibliotecas já foi decidida — ver
   [docs/adr/0001-cli-libs.md](docs/adr/0001-cli-libs.md) para o
   racional completo (Commander, chalk, @clack/prompts, listr2,
   figlet + gradient-string, cli-table3). Não troque nem adicione
   bibliotecas equivalentes sem antes registrar uma nova ADR em
   `docs/adr/`.

4. Ferramental do projeto:
   - Gerenciador de pacotes: **npm** (não usar yarn/pnpm).
   - Testes: **Vitest** (`npm test` / `npm run test:watch`).
   - Build: **tsup** (`npm run build`).
   - Execução em desenvolvimento: **tsx** (`npm run dev`).
   - Checagem de tipos: `npm run typecheck` (`tsc --noEmit`) —
     necessário rodar separadamente, pois o build via esbuild/tsup
     não valida tipos.

5. O projeto é **ESM-only** (`"type": "module"` no `package.json`).
   Várias dependências (`chalk`, `@clack/prompts`, `listr2`) só
   funcionam como ESM — não introduza código ou dependências que
   assumam CommonJS.
