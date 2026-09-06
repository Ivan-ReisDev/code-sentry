# ADR 0003: Limite de concorrência no processamento de arquivos do scanner

- **Status:** Aceito
- **Data:** 2026-09-06

## Contexto

`runScan` (`src/scanner/scanner.ts`) hoje lê o conteúdo de **todos** os
arquivos encontrados por `findFiles` e roda todas as `rules` sobre cada
um simultaneamente, via `Promise.all(files.map(...))`, sem nenhum
limite de concorrência. Em projetos muito grandes (centenas de
arquivos, milhares de problemas), isso significa manter o conteúdo de
todos os arquivos na memória ao mesmo tempo, além de abrir centenas de
descritores de arquivo simultaneamente — risco real de estourar
memória ou esbarrar em limites de I/O do sistema operacional.

`file-finder.ts` já retorna a lista completa de paths antes de
qualquer processamento (não é streaming) — mudar isso está fora de
escopo aqui; o problema a resolver é limitar a concorrência do
**processamento** (leitura + regras), não da enumeração de arquivos.

## Opções consideradas

1. **Implementação manual de uma fila com limite** (ex: dividir os
   arquivos em lotes de N e rodar `Promise.all` por lote, ou um pool
   caseiro com contador). Zero dependência nova, mas reimplementa uma
   lógica já resolvida e testada exaustivamente por bibliotecas
   maduras; lotes fixos (`chunk`) também sub-utilizam a concorrência
   disponível (um arquivo lento no lote atrasa todo o próximo lote).
2. **`p-queue`** — fila de tarefas mais completa (prioridades,
   pausa/retomada, timeouts, eventos). Resolve o problema, mas traz
   bem mais superfície de API do que o necessário — só precisamos
   limitar a concorrência de uma lista já conhecida de tarefas, não
   gerenciar uma fila dinâmica de longa duração.
3. **`async`** (biblioteca genérica de controle de fluxo, ex:
   `async.mapLimit`) — resolve o problema, mas é uma dependência
   grande e antiga, com estilo de API baseado em callbacks (precisa
   de wrappers para uso com `async`/`await`), destoante do resto do
   código (100% `async`/`await` nativo).
4. **`p-limit`** — biblioteca pequena e madura, focada
   exclusivamente em "rodar no máximo N promises por vez", com API
   mínima (`const limit = pLimit(n); limit(() => tarefa())`) e poucas
   dependências transitivas (apenas `yocto-queue`). Encaixa
   exatamente no problema (lista já conhecida de arquivos + limite
   fixo), sem features desnecessárias.

## Decisão

Adotar a **opção 4 (`p-limit`)**, encapsulada em um utilitário
próprio e testável, `src/scanner/run-with-concurrency-limit.ts`
(`runWithConcurrencyLimit(items, concurrency, task)`), usado
internamente por `runScan`. `runScan` ganha um terceiro parâmetro
opcional `concurrency` (default `DEFAULT_SCAN_CONCURRENCY = 10`),
mantendo compatibilidade com todos os chamadores existentes que
invocam `runScan(path, rules)` com dois argumentos.

Isolar a chamada a `p-limit` num utilitário genérico (em vez de usá-la
diretamente dentro de `scanFile`/`runScan`) permite testar a lógica de
limite de concorrência de forma determinística e sem flakiness, com
tarefas fake controladas por promises manuais — sem precisar mockar
`fs` ou depender de timing real de I/O (que é rápido demais para
expor uma condição de corrida em teste).

## Consequências

- Nova dependência direta: `p-limit` (~7.x, apenas `yocto-queue` como
  dependência transitiva).
- Uso de memória e file descriptors do scanner passa a ter um teto
  previsível independentemente do tamanho do projeto analisado.
- `findFiles` continua não-streaming (toda a lista de paths ainda é
  carregada em memória antes do processamento) — aceito como
  limitação conhecida; só o processamento (leitura + regras) tem
  concorrência limitada. Se o número de *arquivos* (não o conteúdo)
  se tornar o gargalo de memória, reavaliar tornar `file-finder.ts`
  um gerador assíncrono.
- O valor de concorrência (`10`) é um default fixo por enquanto; expor
  isso como flag de CLI (`--concurrency`) fica em aberto para uma
  iteração futura, caso necessário.
