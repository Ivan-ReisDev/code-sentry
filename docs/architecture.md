# Arquitetura do CodeSentry

Estrutura de pastas do projeto, a responsabilidade de cada uma e o fluxo de
dados `command → scanner → rules → reporter`.

## Estrutura de pastas

```
├── src/
│   ├── commands/
│   │   ├── scan/
│   │   │   ├── scan.command.ts
│   │   │   ├── scan-runner.ts
│   │   │   └── report-filename.ts
│   │   ├── rules/rules.command.ts
│   │   ├── help/help.command.ts
│   │   ├── init/init.command.ts
│   │   ├── dependency-audit/dependency-audit.command.ts
│   │   └── <regra>/<regra>.command.ts   # um comando standalone por regra
│   │
│   ├── scanner/
│   │   ├── scanner.ts                # motor nativo: aplica rules/ sobre cada arquivo
│   │   ├── file-finder.ts            # descoberta de arquivos (percorre dir por dir)
│   │   ├── run-with-concurrency-limit.ts
│   │   ├── scan-result.ts            # ScanResult, ScanEngines, mergeScanResults
│   │   ├── dependency-audit.ts       # wrapper de `npm audit --json`
│   │   ├── semgrep.ts                # executa o Semgrep embutido e mapeia o JSON
│   │   ├── semgrep-runtime.ts        # resolve o runtime (python/semgrep) da plataforma
│   │   └── semgrep-rules.ts          # resolve o ruleset OWASP embutido
│   │
│   ├── parser/
│   │   └── source-file.ts            # parseSourceFile()/visitSourceNodes() via @babel/parser
│   │
│   ├── rules/
│   │   ├── rule.interface.ts
│   │   ├── index.ts                  # allRules — registro central das regras nativas
│   │   ├── lib/                      # helpers compartilhados entre regras
│   │   │   ├── ast-ancestors.ts      # walkWithAncestors()
│   │   │   ├── function-info.ts      # FUNCTION_TYPES, getFunctionName/StartLine
│   │   │   ├── statement-count-rule.ts  # factory p/ regras "função tem N ifs/loops/..."
│   │   │   └── eslint-linter.ts      # roda plugins ESLint (Linter em memória, sem config do alvo)
│   │   └── <nome>.rule.ts            # ~30 regras — uma por arquivo, ver `codesentry rules`
│   │
│   ├── reporters/
│   │   ├── console.reporter.ts
│   │   ├── json.reporter.ts
│   │   └── markdown.reporter.ts
│   │
│   ├── config/
│   │   └── config.ts
│   │
│   ├── errors.ts                     # formatErrorChain() — percorre error.cause até o fim
│   ├── cli.ts
│   └── index.ts
│
├── packages/                         # monorepo: pacotes publicados à parte do CLI
│   ├── semgrep-rules/                # snapshot local do ruleset p/owasp-top-ten
│   ├── semgrep-linux-x64/            # Python portátil + Semgrep CE para Linux x64
│   └── semgrep-win32-x64/            # idem para Windows x64
│
├── scripts/                          # scripts de release (Node/Python, fora do build da CLI)
│   ├── prepare-owasp-rules.mjs       # baixa e fixa o ruleset OWASP
│   ├── write-runtime-lock.mjs        # grava versões/checksum do runtime empacotado
│   ├── write-runtime-manifest.mjs    # grava o caminho do executável semgrep no manifest
│   └── rewrite-shebang.py            # reescreve o shebang dos console_scripts do pip
│
├── .github/workflows/release.yml     # pipeline de publish (ver ADR 0004)
├── tests/                            # espelha a estrutura de src/
├── docs/adr/                         # decisões de arquitetura registradas
├── eslint.config.js / prettier.config.js
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Responsabilidade de cada pasta

| Pasta       | Responsabilidade                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands`  | Recebe e trata os comandos da CLI. Cada comando mora no seu próprio subdiretório (`<nome>/<nome>.command.ts`); a maioria das regras também tem um comando standalone que roda só ela.                |
| `scanner`   | Descobre arquivos, aplica as `rules/` sobre cada um (motor nativo), roda o Semgrep embutido e o `npm audit`, e une os resultados em um `ScanResult`.                                                 |
| `parser`    | Parsing de código-fonte (`@babel/parser`) e travessia de AST compartilhados por várias regras — não depende de `tsconfig`/config do projeto analisado.                                               |
| `rules`     | As regras de análise nativas. Cada uma implementa `rule.interface.ts`; `lib/` guarda helpers reutilizados entre elas (travessia com ancestrais, contagem de statements, execução de plugins ESLint). |
| `reporters` | Exibe ou exporta os resultados (console, JSON, Markdown) — cada um só recebe um `ScanResult` pronto.                                                                                                 |
| `config`    | Lê e resolve as configurações do usuário.                                                                                                                                                            |
| `errors`    | Formata a cadeia completa de `error.cause` para mensagens de erro da CLI, em vez de só a mensagem do wrapper mais externo.                                                                           |
| `packages`  | Sub-pacotes do monorepo publicados separadamente no npm: o ruleset OWASP e os runtimes Semgrep/Python por plataforma — ver [ADR 0004](adr/0004-bundled-semgrep-runtime.md).                          |
| `scripts`   | Scripts standalone usados só durante a preparação de uma release (fora do bundle da CLI).                                                                                                            |
| `tests`     | Espelha a estrutura de `src/`, um `*.spec.ts` por módulo.                                                                                                                                            |

## Fluxo básico

1. `index.ts` inicia a CLI chamando `cli.ts`.
2. `cli.ts` registra todos os comandos (`commands/`) no `Command` do Commander e lê a versão do `package.json` em tempo de execução.
3. `scan.command.ts` aciona `scan-runner.ts`, que roda dois motores em sequência e funde o resultado:
      - **Motor nativo** (`scanner/scanner.ts`): `file-finder.ts` localiza os arquivos JS/TS/JSX/TSX (pulando `node_modules`, `.git`, `dist`, `.next`, `tests` — nunca descendo neles, mesmo que estejam corrompidos ou com caminho longo demais), e cada regra de `rules/` roda sobre o conteúdo via `run-with-concurrency-limit.ts`.
      - **Semgrep embutido** (`scanner/semgrep.ts`): roda o ruleset `p/owasp-top-ten` (resolvido por `semgrep-rules.ts`) usando o runtime da plataforma atual (resolvido por `semgrep-runtime.ts`), e mapeia o JSON de saída para o mesmo formato de finding.
      - `scan-result.ts#mergeScanResults` une os dois em um único `ScanResult`, com a cobertura de cada motor em `engines`.
4. O resultado é passado para um `reporter` (`console.reporter.ts`, `json.reporter.ts` ou, quando há mais de 20 problemas, também `markdown.reporter.ts`), que exibe ou exporta o relatório final.
5. Falhas em qualquer etapa sobem como `Error` encadeados (`cause`); `errors.ts#formatErrorChain` percorre essa cadeia inteira ao reportar o erro final na CLI, em vez de mostrar só a mensagem do wrapper mais externo.

## Convenções

- Cada regra em `rules/` implementa `rule.interface.ts`, o que permite adicionar novas regras sem alterar o `scanner`. Toda nova regra precisa ser registrada em `rules/index.ts` (`allRules`) para rodar como parte de `codesentry scan` — uma regra só com arquivo e teste, mas sem entrada em `allRules`, não é executada no scan real.
- Regras que precisam de AST usam `parser/source-file.ts` (via `@babel/parser`, tolerante a erros de sintaxe) em vez de depender de `typescript`/config do projeto analisado — ver [ADR 0002](adr/0002-security-tooling.md) para o porquê dessa escolha de parser. Regras que reaproveitam cobertura já madura de plugins ESLint (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`) passam por `rules/lib/eslint-linter.ts`, que roda um `Linter` do ESLint em memória, sem exigir `eslintrc`/config do projeto alvo.
- Cada reporter é independente do `scanner` — ele só recebe um `ScanResult` já pronto e decide como exibi-lo.
- O `scanner` processa os arquivos com concorrência limitada (via `run-with-concurrency-limit.ts`, usando `p-limit`) para evitar picos de memória em projetos muito grandes — ver [ADR 0003](adr/0003-concurrency-limit.md).
- Quando o resultado tem mais de 20 problemas, `scan-runner.ts` gera automaticamente um relatório em Markdown (`markdown.reporter.ts`) na raiz do diretório analisado, além da saída no console/JSON.
- O Semgrep embutido roda offline, sem depender de Python/Docker instalados pelo usuário — o racional completo (runtime portátil por plataforma, ruleset fixado por versão, sem consultar a Semgrep Registry) está no [ADR 0004](adr/0004-bundled-semgrep-runtime.md).
- TDD é obrigatório: toda mudança de comportamento começa por um teste que falha em `tests/`, antes de qualquer implementação (ver `CLAUDE.md`).
