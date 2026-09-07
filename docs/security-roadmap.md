# Roadmap de segurança do CodeSentry

Este documento registra as lacunas identificadas no conjunto atual de
análises e uma ordem sugerida para evoluir o produto.

## Correções de cobertura antes de novas regras

Estas mudanças aproveitam funcionalidades já existentes e devem vir antes de
ampliar o catálogo de detecções.

1. Registrar `weak-cipher-mode` e `hardcoded-authorization-value` em
   `src/rules/index.ts`. As regras existem, mas não fazem parte de `allRules`;
   portanto, não são executadas por `codesentry scan`.
2. Integrar `dependency-audit` ao comando `scan`, ou deixar claro na saída que
   ele precisa ser executado separadamente. Hoje o wrapper de `npm audit`
   existe, mas não participa do scan principal.
3. Tornar uma cobertura Semgrep igual a zero um aviso explícito ou erro. Um
   ruleset offline ausente/não preparado não pode parecer uma análise limpa.

## Próximas regras de maior impacto

| Prioridade | Detecção                     | Exemplos de risco                                                                                                  |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Alta       | SSRF                         | URL controlada pelo usuário em `fetch`, Axios ou bibliotecas HTTP, com acesso a IPs internos/metadados cloud.      |
| Alta       | Path traversal               | Valores de request usados em `readFile`, `sendFile`, upload, extração de ZIP/TAR ou caminhos de cache.             |
| Alta       | IDOR e autorização ausente   | Rotas que acessam recursos por ID sem checagem de ownership/permissão.                                             |
| Alta       | Open redirect                | Entrada não validada em `res.redirect()` e APIs equivalentes.                                                      |
| Alta       | Cookies inseguros            | Sessões sem `httpOnly`, `secure` ou `sameSite` apropriado.                                                         |
| Alta       | GitHub Actions perigosas     | `pull_request_target`, permissões excessivas, contextos não confiáveis em comandos shell e downloads sem checksum. |
| Média      | Prototype pollution          | Uso de `Object.assign`, `lodash.merge` e deep merge com objetos controlados externamente.                          |
| Média      | ReDoS                        | Expressões regulares com backtracking catastrófico, incluindo literais.                                            |
| Média      | Segredos por padrão/entropia | Tokens de AWS, GitHub, Stripe e outras credenciais, além de strings de alta entropia.                              |
| Média      | Infraestrutura como código   | Docker, Kubernetes e Terraform: root, capabilities, imagens `latest` e segredos em variáveis de ambiente.          |

## Melhorias de produto

- Exportar SARIF para integração com GitHub Code Scanning e outros serviços de
  segurança.
- Implementar baseline para distinguir dívida técnica existente de achados
  novos.
- Criar `--changed` para analisar apenas arquivos alterados em pull requests.
- Permitir configuração de severidade, regras habilitadas e supressões com
  justificativa e data de expiração.
- Mostrar no relatório quais motores foram executados, quantos arquivos cada
  um analisou e por que algum motor foi ignorado.

## Ordem recomendada

1. Corrigir o registro das regras existentes, integrar o audit e tornar a
   cobertura Semgrep verificável.
2. Adicionar SSRF, path traversal, IDOR e open redirect.
3. Cobrir segurança de cookies e workflows do GitHub Actions.
4. Entregar SARIF, baseline e `--changed` para viabilizar adoção em CI.
5. Expandir para prototype pollution, ReDoS, secrets avançados e IaC.

## Critérios para cada nova regra

- Começar com um teste que falha e incluir casos positivos e negativos.
- Registrar a regra em `allRules` e, quando aplicável, expô-la como comando
  standalone.
- Informar mensagem acionável, severidade consistente e linha precisa.
- Evitar falsos positivos conhecidos ou oferecer supressão local documentada.
- Validar que a regra aparece no resultado de `codesentry scan`.
