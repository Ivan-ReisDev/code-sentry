# ADR 0001: Bibliotecas para a CLI (identidade visual e interatividade)

- **Status:** Proposto
- **Data:** 2026-09-05

## Contexto

O CodeSentry é uma CLI em TypeScript para verificação de vulnerabilidades e
qualidade de código. Ainda estamos na fase de estudo/definição de stack.
Um dos requisitos de produto é que a CLI tenha **identidade visual forte**
(cores, banner, estilo próprio) e uma **experiência rica e interativa**
(spinners, progresso de tarefas, prompts), já que o usuário vai rodar
comandos como `scan`, `report`, `init` e acompanhar o andamento de análises
que podem levar algum tempo.

## Opções consideradas

1. **Combo de libs especializadas** (Commander + chalk + @clack/prompts +
   listr2 + figlet/gradient-string) — cada camada resolvida pela melhor
   ferramenta do nicho.
2. **Ink** (React para terminal) — permite montar um dashboard *live* de
   verdade, com componentes reativos. Mais poder, mais complexidade/peso.
3. **Gluegun** — framework "tudo em um" que já empacota várias dessas
   libs. Mais rápido para começar, porém menos flexível para uma
   identidade muito customizada.
4. **oclif** (Salesforce) — framework de CLI mais robusto, com suporte a
   plugins e estrutura de comandos mais rígida. Interessante se o projeto
   crescer para múltiplos plugins/comandos complexos.

## Decisão

Adotar o **combo de libs especializadas** como ponto de partida:

| Camada | Lib | Papel |
|---|---|---|
| Parsing de comandos | **Commander.js** | Define `codesentry scan`, `codesentry report`, etc. |
| Cores base | **chalk** | Colorir texto/saídas no terminal. |
| Prompts interativos | **@clack/prompts** | Perguntas, confirmações e seleção com visual coeso. |
| Progresso de tarefas | **listr2** | Lista de tarefas aninhadas com spinner durante o scan (ex: dependências, SAST, etc). |
| Banner/logo | **figlet** + **gradient-string** | Banner ASCII colorido com o nome do projeto no `--help`/início. |
| Tabelas de resultado | **cli-table3** | Exibição de vulnerabilidades (severidade, CVE, arquivo). |

Motivo: é o caminho mais rápido para já sair com uma CLI colorida e com
identidade, cobrindo o fluxo principal (rodar scan → ver progresso →
responder prompts de config → ver relatório final em tabela).

### Alternativa em espera

Se o scan evoluir para precisar de um **dashboard live** mais sofisticado
(múltiplos painéis atualizando em tempo real), avaliar migrar a camada de
progresso para **Ink**, mantendo Commander para parsing de comandos.

### Rejeitadas por ora

- **Gluegun**: menos controle sobre a identidade visual customizada.
- **oclif**: complexidade de setup não se justifica ainda; reavaliar se o
  projeto crescer para uma arquitetura de plugins.

## Consequências

- Setup inicial rápido, com poucas dependências por camada.
- Caso o requisito de "dashboard live" apareça, será necessário refatorar
  a camada de progresso para Ink (custo de migração aceito como risco
  conhecido).
- Reavaliar oclif caso a CLI cresça para múltiplos plugins/subcomandos
  complexos.
