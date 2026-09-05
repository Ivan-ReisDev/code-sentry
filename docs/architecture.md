# Arquitetura do CodeSentry

Estrutura inicial de pastas do projeto e a responsabilidade de cada uma.

## Estrutura de pastas

```
├── src/
│   ├── commands/
│   │   ├── scan.command.ts
│   │   ├── init.command.ts
│   │   └── rules.command.ts
│   │
│   ├── scanner/
│   │   ├── scanner.ts
│   │   ├── file-finder.ts
│   │   └── scan-result.ts
│   │
│   ├── rules/
│   │   ├── rule.interface.ts
│   │   ├── no-eval.rule.ts
│   │   ├── no-hardcoded-secret.rule.ts
│   │   └── unsafe-sql.rule.ts
│   │
│   ├── reporters/
│   │   ├── console.reporter.ts
│   │   └── json.reporter.ts
│   │
│   ├── config/
│   │   └── config.ts
│   │
│   ├── cli.ts
│   └── index.ts
│
├── tests/
│   ├── scanner.spec.ts
│   └── rules/
│       └── no-eval.rule.spec.ts
│
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Responsabilidade de cada pasta

| Pasta | Responsabilidade |
|---|---|
| `commands` | Recebe e trata os comandos da CLI, como `scan`, `init` e `rules` |
| `scanner` | Procura os arquivos do projeto e coordena a análise |
| `rules` | Contém as regras que identificam problemas (ex: uso de `eval`, segredo hardcoded, SQL inseguro) |
| `reporters` | Exibe ou exporta os resultados (console, JSON, etc) |
| `config` | Lê e resolve as configurações do usuário |
| `tests` | Testes do scanner e das regras |

## Fluxo básico

1. `index.ts` inicia a CLI chamando `cli.ts`.
2. `cli.ts` registra os comandos (`commands/`) usando o parser da CLI.
3. Um comando como `scan.command.ts` aciona o `scanner/scanner.ts`.
4. O `scanner` usa o `file-finder.ts` para localizar os arquivos e aplica
   as `rules/` sobre cada um, gerando um `scan-result.ts`.
5. O resultado é passado para um `reporter` (`console.reporter.ts` ou
   `json.reporter.ts`), que exibe ou exporta o relatório final.

## Convenções

- Cada regra em `rules/` implementa `rule.interface.ts`, o que permite
  adicionar novas regras sem alterar o `scanner`.
- Cada reporter é independente do `scanner` — ele só recebe um
  `scan-result.ts` já pronto e decide como exibi-lo.
