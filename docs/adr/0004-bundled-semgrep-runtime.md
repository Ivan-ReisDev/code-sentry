# ADR 0004: Runtime Semgrep CE e ruleset OWASP embutidos

- **Status:** Aceito
- **Data:** 2026-09-06

## Contexto

O CodeSentry precisa de cobertura OWASP multi-linguagem sem transferir ao
usuário instalação de Python, Docker, Semgrep, login ou acesso à Semgrep
Registry. Uma integração que procurasse `semgrep` no `PATH` falharia em
instalações comuns e não garantiria versões reproduzíveis das regras.

## Decisão

Publicar, para cada release, os pacotes opcionais
`codesentry-semgrep-linux-x64` e `codesentry-semgrep-win32-x64`. Cada um
contém CPython portátil, Semgrep CE e suas dependências. O pacote principal
resolve exclusivamente o pacote da plataforma atual e executa
`python -m semgrep`; ele nunca procura binários no `PATH`.

O pacote `codesentry-semgrep-rules` contém um snapshot do ruleset
`p/owasp-top-ten` em YAML. A preparação de release baixa o ruleset uma única
vez, grava seu SHA-256 e o publica como arquivo local. O processo do usuário
sempre recebe `--config <arquivo-local>` e `--metrics=off`; portanto não usa
rede nem pede autenticação durante o scan.

O scan padrão roda motor nativo e Semgrep em sequência. Resultados são unidos
no mesmo relatório, com IDs `semgrep/<id>`, mas a contagem `scannedFiles`
continua sendo a do motor nativo; `engines.semgrep` informa a cobertura
separadamente.

## Consequências

- Suporte inicial: Linux x64 e Windows x64. Outras plataformas encerram o
  scan explicitamente, pois uma análise parcial não pode ser apresentada como
  cobertura OWASP completa.
- Os pacotes são significativamente maiores que uma CLI Node comum. O custo
  compra instalação única e operação offline.
- Semgrep, Python e ruleset são atualizados somente em uma nova release,
  sempre com versões e checksums registrados no artefato. A revisão de
  licenças e a inclusão dos avisos são obrigatórias antes da primeira
  publicação.
- A rede continua podendo ser usada por comandos independentes como `npm
audit`; ela não é requisito do `codesentry scan`.
