# ADR 0005: OSV.dev como complemento ao npm audit para SCA, integrado ao scan

- **Status:** Aceito
- **Data:** 2026-09-13

## Contexto

A ADR 0002 já decidiu usar `npm audit --json` diretamente para a
auditoria de dependências (SCA), "em vez de reimplementar um banco de
vulnerabilidades ou adicionar outra dependência pesada". Essa decisão
continua válida — o que muda agora é o que fazemos com ela:

1. O `npm audit` já retorna `fixAvailable`/`range` no JSON, mas o
   `dependency-audit.ts` nunca usava esses campos na mensagem — o
   usuário só via "há uma vulnerabilidade", não "atualize para X".
2. A cobertura do `npm audit` se limita à base de advisories do
   registry npm. O [OSV.dev](https://api.osv.dev) agrega advisories de
   múltiplas fontes (GitHub Advisory Database, NVD, etc.) para o
   ecossistema npm, com dados estruturados de versão corrigida
   (`affected[].ranges[].events[].fixed`) por pacote — verificado
   contra uma resposta real da API (pacote `lodash`, 5 advisories,
   anexada como `api.osv.json` durante o desenvolvimento desta ADR).
3. `codesentry dependency-audit` hoje é um comando isolado — o
   `codesentry scan` roda 100% offline (motor nativo + Semgrep
   embutido) e nunca inclui a auditoria de dependências, exigindo que o
   usuário rode os dois comandos separadamente.

O usuário pediu explicitamente: (a) usar a API gratuita do OSV.dev para
identificar vulnerabilidades nas dependências reais do projeto; (b) que
o `scan` passe a incluir essa checagem por padrão; e (c) que toda
sugestão de correção mostrada venha literalmente do banco de dados
consultado (OSV/npm), nunca inventada pelo CodeSentry.

## Opções consideradas

1. **Manter só `npm audit`** — mais simples, mas remediação pobre
   (`fixAvailable`/`range` continuariam sem uso) e nenhuma cobertura
   além do registry npm.
2. **Substituir `npm audit` por OSV.dev** — perderia a integração
   nativa já validada na ADR 0002 e um sinal que já funciona sem
   nenhum código de enumeração de dependências próprio.
3. **Combinar os dois no mesmo comando `dependency-audit`** — união de
   achados, com o `npm audit` como fonte autoritativa por pacote (dedupe
   por nome) e o OSV.dev como complemento só para pacotes que o
   `npm audit` não sinalizou. Reaproveita 100% do parsing já existente;
   nenhuma dependência nova, já que o OSV.dev é consumido via `fetch`
   nativo (Node ≥22.12.0, já exigido pelo projeto), no mesmo estilo de
   `fetchImpl` injetável já usado em `scripts/prepare-owasp-rules.mjs`.

## Decisão

Adotar a opção 3, com dois pontos de entrada:

| Componente                                    | Papel                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scanner/package-lock-parser.ts` (novo)   | Enumera dependências reais a partir do `package-lock.json` (`lockfileVersion` 2/3), não de uma varredura física de `node_modules/`.                                                                                                                                                     |
| `src/scanner/osv-client.ts` (novo)            | `POST /v1/querybatch` (em lotes de 100) para descobrir ids de vulnerabilidade por pacote, depois `GET /v1/vulns/{id}` (concorrência 10) só para os ids distintos encontrados — evita buscar detalhe completo para centenas de pacotes sem vulnerabilidade.                              |
| `src/scanner/dependency-audit.ts` (estendido) | Combina achados do `npm audit` (autoritativo por nome de pacote) com os do OSV.dev (complementar). Mensagens de correção usam exclusivamente `fixAvailable`/`range` (npm) ou `affected[].ranges[].events[].fixed` (OSV) — nunca uma sugestão própria do CodeSentry.                     |
| `codesentry scan` (novo `--no-deps`)          | Passa a rodar a auditoria por padrão; `deps` é opt-in internamente (`ScanOutputOptions.deps`, no mesmo padrão de `semgrep`), ativado só pela flag `--no-deps` negatável do Commander no comando `scan` — os ~30 comandos individuais por regra continuam sem tocar em rede/`npm audit`. |

## Amendment à ADR 0004

A ADR 0004 registrou: "A rede continua podendo ser usada por comandos
independentes como `npm audit`; ela não é requisito do
`codesentry scan`." Esta ADR revoga essa frase especificamente: a
partir de agora, `codesentry scan` executa a auditoria de dependências
(`npm audit` + OSV.dev) por padrão, o que exige rede. A flag
`--no-deps` é o escape hatch documentado para manter um scan 100%
offline (CI sem egress, ambientes air-gapped). O restante da ADR 0004
(Semgrep embutido, sem Registry/autenticação) continua válido e
inalterado.

## Consequências

- `codesentry scan` passa a exigir rede por padrão — mudança de
  comportamento observável, documentada no `--help` do comando e no
  README; `--no-deps` restaura o modo 100% offline.
- Falha do OSV.dev (rede/timeout/resposta não-2xx) ou de leitura/parsing
  do `package-lock.json` nunca aborta o scan nem o `dependency-audit` —
  vira aviso em `warnings`, e `engines.dependencyAudit` reflete só a
  cobertura de fato obtida. Falha real do `npm audit` (binário ausente)
  continua abortando o comando standalone `dependency-audit`
  (inalterado), mas dentro do `scan` também vira aviso.
- Dedupe por nome de pacote entre `npm audit` e OSV.dev é uma
  simplificação deliberada de escopo inicial — não correlaciona por
  advisory id entre as duas fontes.
- `lockfileVersion` 1 (estrutura `dependencies` aninhada, pré-npm 7) não
  é suportado — erro claro, documentado como gap conhecido.
- Nenhuma dependência npm nova: OSV.dev é consumido via `fetch` global.
- `ScanResult` ganhou `engines.osv: { checked, total }` e
  `osvCheckedPackages: string[]` (todo pacote de um lote `querybatch` que
  recebeu resposta da OSV, vulnerável ou não — lotes que falharam ficam de
  fora). `console.reporter.ts` exibe o resumo `checked/total`;
  `markdown.reporter.ts` lista os pacotes verificados numa seção própria.
  Existe só para transparência de cobertura — não afeta os `findings`.
