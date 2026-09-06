# ADR 0002: Ferramental para regras de segurança (SAST complementar e auditoria de dependências)

- **Status:** Aceito
- **Data:** 2026-09-06

## Contexto

Além das regras estruturais/de correção já existentes (todas
hand-rolled sobre `@babel/parser`, ver `docs/architecture.md`), o
CodeSentry precisa cobrir uma bateria de checks de segurança: uso de
`eval`/`new Function`, command injection, SQL injection por
concatenação, JWT sem expiração, segredos hardcoded, CORS permissivo,
tokens gerados com `Math.random()`, hashes fracos (MD5/SHA-1), TLS
com validação desativada e Express sem limite de body — todos viáveis
como regras próprias sobre a AST do Babel, sem dependência nova.

Dois casos, porém, não são bem cobertos só com heurísticas de texto/
AST simples:

1. **XSS** — os sinks perigosos (`innerHTML`, `document.write`, etc.)
   exigem reconhecer o que já é "provavelmente seguro" (ex: atribuição
   de string literal) para não gerar ruído excessivo.
2. **Padrões de segurança genéricos** (object injection via colchetes
   com chave não literal, regex não literal/catastrófico, `fs` com
   filename não literal, `pseudoRandomBytes`, buffers inseguros,
   timing attacks, mustache escaping desabilitado, CSRF sem checagem
   de método) — um catálogo amplo e já mapeado pela comunidade, que
   não vale a pena reimplementar do zero.

Adicionalmente, o usuário pediu explicitamente uma forma de detectar
**dependências do próprio projeto analisado com vulnerabilidades
conhecidas** (SCA), coisa que nenhuma regra baseada em AST de
código-fonte resolve — isso exige uma base de dados de advisories.

## Opções consideradas

1. **100% hand-rolled em cima do `@babel/parser`** — consistente com
   o resto do projeto, mas reimplementar detecção de XSS e o catálogo
   do `eslint-plugin-security` do zero é retrabalho desnecessário e
   tende a ter pior cobertura que as libs já maduras da comunidade.
2. **Ferramenta externa tipo Semgrep/njsscan** — cobertura muito boa,
   porém são binários/runtimes externos (Python, no caso do
   njsscan), fora do ecossistema npm, com fricção de instalação e
   operação bem maior do que o resto desta CLI (que é 100% Node/npm).
3. **ESLint (`Linter` em memória) + `eslint-plugin-security` +
   `eslint-plugin-no-unsanitized`**, usando `@typescript-eslint/parser`
   para gerar a AST — abordagem natural no ecossistema JS/TS, mas
   **inviável neste projeto**: `@typescript-eslint/parser` trava em
   tempo de execução com TypeScript 7 (`"typescript-eslint does not
   support TS 7.0"`), que é a versão já usada pelo CodeSentry.
   Confirmado empiricamente antes de prosseguir.
4. **ESLint (`Linter` em memória) + `eslint-plugin-security` +
   `eslint-plugin-no-unsanitized`, usando `@babel/eslint-parser`** para
   gerar a AST em vez do `@typescript-eslint/parser` — mesmas libs de
   regras, mas o parser passa a ser o `@babel/eslint-parser` (adapta a
   AST do `@babel/parser`, que o projeto já usa, para o formato ESTree
   que o ESLint espera), com `@babel/plugin-syntax-typescript` só
   habilitando a sintaxe TS na leitura (sem checagem de tipos, sem
   depender do pacote `typescript`). Validado empiricamente: parseia
   `.ts` com sintaxe de tipos e roda as regras corretamente.
5. **`npm audit` direto** para a auditoria de dependências vs. uma lib
   própria de SCA — usar a base de advisories do npm (já madura, já
   presente em qualquer ambiente Node/npm) em vez de reimplementar um
   banco de vulnerabilidades ou adicionar outra dependência pesada.

## Decisão

Adotar a **opção 4 + 5**:

| Camada | Lib | Papel |
|---|---|---|
| Motor de lint em memória | **eslint** (`Linter`) | Roda regras de terceiros sobre o conteúdo de cada arquivo, sem precisar de `eslintrc`/config do projeto alvo. |
| Parser (AST → ESTree) | **@babel/eslint-parser** + **@babel/core** (peer) + **@babel/plugin-syntax-typescript** | Gera AST compatível com ESLint a partir do `@babel/parser`, evitando o pacote `typescript` (e o crash do `@typescript-eslint/parser` com TS 7). Só sintaxe — sem checagem de tipos. |
| Sinks de XSS | **eslint-plugin-no-unsanitized** | `no-unsanitized/property` e `no-unsanitized/method` — detecta atribuições/chamadas perigosas (`innerHTML`, `document.write`, etc.) com conteúdo não comprovadamente seguro. |
| Padrões gerais de segurança | **eslint-plugin-security** | Sub-regras selecionadas (object injection, regex não literal/catastrófico, `fs` não literal, `pseudoRandomBytes`, timing attack, buffer inseguro, mustache escape, CSRF sem checagem de método) — excluindo as que se sobrepõem a regras hand-rolled próprias (`detect-eval-with-expression`, `detect-child-process`). |
| Auditoria de dependências (SCA) | **`npm audit --json`** (via `child_process.execFile`, sem lib nova) | Fonte de verdade madura para vulnerabilidades conhecidas nas dependências do projeto analisado. |

SQL injection genérica por concatenação continua **hand-rolled**
(`unsafe-sql`): não existe uma lib madura de nicho JS/ESLint
consolidada para esse caso específico — as alternativas realmente
maduras (Semgrep/CodeQL com regras customizadas) são ferramentas
pesadas, fora de escopo aqui.

### Rejeitadas por ora

- **Semgrep/njsscan**: dependeriam de um runtime externo
  (Python/binário) fora do ecossistema npm, com fricção de instalação
  desproporcional ao resto da CLI.
- **`@typescript-eslint/parser`**: incompatível com TypeScript 7 (erro
  em tempo de execução, não só aviso de peer dependency).

## Consequências

- Novas dependências: `eslint`, `@babel/eslint-parser`, `@babel/core`,
  `@babel/plugin-syntax-typescript`, `eslint-plugin-security`,
  `eslint-plugin-no-unsanitized`.
- As regras baseadas em ESLint (`xss`, `security-lint`) só fazem
  análise sintática (sem checagem de tipos) — mesmo nível de precisão
  que as regras hand-rolled existentes, só que reaproveitando um
  catálogo de detecção mais amplo e testado pela comunidade.
- `dependency-audit` depende de `npm` disponível no `PATH` e de acesso
  de rede (base de advisories do npm) — é a única regra/comando desta
  bateria com essa dependência externa; documentado no `--help` do
  comando.
- Se o `@typescript-eslint/parser` vier a suportar TypeScript 7 no
  futuro, reavaliar a troca (reduziria uma dependência, já que
  `@typescript-eslint/parser` também traria checagem mais rica), mas
  não é bloqueante hoje.
