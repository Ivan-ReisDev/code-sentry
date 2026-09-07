<p align="center">
  <img src="docs/assets/logo.png" alt="Logo do CodeSentry" width="640">
</p>

# CodeSentry

CLI de verificação de vulnerabilidades e qualidade de código. O scanner
combina regras próprias para JavaScript/TypeScript e o ruleset OWASP do
Semgrep CE para as linguagens suportadas por ele.

- 🔎 **Dois motores num só comando** — regras próprias em TS/JS + Semgrep CE (OWASP Top 10) para dezenas de outras linguagens.
- 📦 **Uma instalação, zero fricção** — `npm install -g codesentry` e pronto: sem Python, Docker, Semgrep ou conta em lugar nenhum.
- 🔌 **100% offline depois de instalado** — nunca consulta a Semgrep Registry nem envia métricas.
- 🪟🐧 **Windows e Linux nativamente** — sem WSL, sem container.
- 📊 **Console, JSON ou Markdown** — saída pronta tanto para ler no terminal quanto para plugar em CI.

## O que o CodeSentry faz

Rodando `codesentry scan` num projeto, dois motores de análise trabalham
juntos e o resultado sai unificado em um único relatório:

- **Motor nativo** — regras próprias em TypeScript, sem dependências
  externas, cobrindo JS/TS/JSX/TSX: segredos hardcoded, SQL injection,
  XSS, command injection, JWT mal configurado, CORS permissivo, hash/
  cifra fracos, promises sem tratamento de erro, complexidade excessiva
  (funções longas, aninhamento profundo, muitos `if`/`for`/`try`), entre
  outras. A lista completa e sempre atualizada está em `codesentry rules`.
- **Semgrep CE embutido** — roda o ruleset `p/owasp-top-ten` sobre todas
  as linguagens que o Semgrep suporta (não só JS/TS), cobrindo os riscos
  do OWASP Top 10 de forma mais ampla que regras hand-rolled sozinhas
  conseguiriam.

Cada achado no relatório mostra o arquivo, a linha, a severidade e qual
motor encontrou o problema (prefixo `semgrep/` para achados do Semgrep).
Saídas disponíveis: tabela no console, JSON (`--json`) e, quando há mais
de 20 problemas, um relatório Markdown detalhado é gerado automaticamente.

Exemplo de saída no console:

```text
❯ codesentry scan .
✔ Scanning files...
┌──────────┬──────────────────────┬─────────────────┬──────┬──────────────────────────────────────────┐
│ Severity │ Rule                 │ File             │ Line │ Message                                    │
├──────────┼──────────────────────┼─────────────────┼──────┼──────────────────────────────────────────┤
│ high     │ no-hardcoded-secret  │ src/config.ts    │ 12   │ Possível segredo hardcoded na variável...  │
│ high     │ semgrep/...shell-true│ scripts/run.py   │ 8    │ subprocess com shell=True é perigoso...    │
│ medium   │ jwt-no-expiration    │ src/auth.ts      │ 34   │ Token JWT assinado sem "expiresIn"...      │
└──────────┴──────────────────────┴─────────────────┴──────┴──────────────────────────────────────────┘

3 problema(s) encontrado(s) em 87 arquivo(s) (4213ms). CodeSentry: 87 JS/TS; Semgrep: 64 arquivo(s).
```

## Como funciona por baixo dos panos

O ponto central do design é **zero fricção de instalação**: o usuário final
roda `npm install -g codesentry` e não precisa instalar Python, Docker,
Semgrep, nem criar conta em lugar nenhum.

Isso é possível porque o Semgrep CE e um Python portátil vêm empacotados
como **dependências opcionais** específicas da plataforma
(`codesentry-semgrep-linux-x64` / `-win32-x64`), resolvidas
automaticamente pelo npm na instalação. O ruleset OWASP também é
distribuído como pacote próprio (`codesentry-semgrep-rules`), como um
snapshot local fixado por versão — o scan nunca consulta a Semgrep
Registry nem envia métricas, e funciona 100% offline depois de instalado.
O racional completo está na [ADR 0004](docs/adr/0004-bundled-semgrep-runtime.md).

## Instalação

Pré-requisito único: [Node.js](https://nodejs.org) 22.12 ou mais recente
(`node --version` para conferir). Nenhum outro requisito — não precisa
instalar Python, Docker, Semgrep, criar conta ou autenticar em nada.

### Windows

No PowerShell ou no Prompt de Comando (não precisa de WSL):

```powershell
npm install -g codesentry
codesentry scan .
```

### Linux

```bash
npm install -g codesentry
codesentry scan .
```

Em ambos os casos, o `npm install` já resolve automaticamente o pacote de
runtime compatível com a sua plataforma (Semgrep CE + Python portátil) como
dependência opcional — é isso que faz `codesentry scan` funcionar com
cobertura OWASP completa sem nenhuma instalação manual. Plataformas com
runtime publicado hoje: Linux x64 e Windows x64. Os pacotes têm dezenas de
MB porque incluem esse runtime embutido; essa é a troca para o scan
funcionar 100% offline depois de instalado.

Se `codesentry` não for encontrado no terminal depois de instalado
globalmente, feche e reabra o terminal (ou rode `npx codesentry scan .`) —
alguns terminais não recarregam o PATH do npm automaticamente na mesma
sessão.

### A partir do código-fonte (desenvolvimento)

Para rodar a partir do repositório clonado, em vez do pacote publicado, use
`npm link`:

```bash
git clone git@github.com:Ivan-ReisDev/code-sentry.git
cd code-sentry
npm install
npm run build
npm link
```

Depois disso, o comando `codesentry` fica disponível em qualquer
diretório do seu terminal.

> **Atenção:** `npx codesentry` rodado de dentro deste repositório clonado
> executa o `dist/index.js` local (o `package.json` daqui se chama
> `codesentry`, e o `npx` prioriza isso sobre a instalação global/publicada).
> O workspace de desenvolvimento sempre tem o ruleset do Semgrep vazio por
> design (populado só via `npm run prepare:owasp-rules` ou durante a release —
> ver [ADR 0004](docs/adr/0004-bundled-semgrep-runtime.md)), então o scan
> roda sem erro mas sempre reporta zero arquivos analisados pelo Semgrep.
> Para testar o pacote publicado de verdade, rode `codesentry scan` (sem
> `npx`) fora deste diretório.

## Uso

### `codesentry scan [path]`

Analisa um diretório (padrão: diretório atual) em busca de
vulnerabilidades e problemas de qualidade.

```bash
codesentry scan .
codesentry scan ./src
codesentry scan . --json
codesentry scan . --concurrency 4
codesentry scan . --config ./rules/security.yml
codesentry scan . --tests
```

O Semgrep CE embutido é executado automaticamente depois das regras nativas,
usando um snapshot local do ruleset OWASP e `--metrics=off`. O comando não
consulta a Semgrep Registry, não envia métricas e não requer internet após a
instalação.

`--concurrency <n>` limita o processamento paralelo do scanner nativo; use
apenas inteiros positivos. Sem valor, o limite é ajustado para a máquina
(`min(8, availableParallelism())`). Não há `--config` remoto: atualizações de
Semgrep e das regras OWASP chegam em novas releases do CodeSentry. Quando
necessário, `--config` aceita exclusivamente um arquivo YAML local.

Por padrão, arquivos de teste não são analisados: nenhum diretório chamado
`tests`, `test` ou `__tests__` (em qualquer profundidade) e nenhum arquivo
com sufixo `.spec.*`/`.test.*` (em qualquer lugar, mesmo fora dessas pastas)
entra no scan. Use `--tests` para incluí-los.

Em macOS, ARM e plataformas sem runtime publicado, o comando interrompe
explicitamente em vez de declarar uma análise parcial como completa.

### `codesentry rules`

Lista as regras de análise disponíveis (id e descrição de cada uma).

```bash
codesentry rules
```

### `codesentry help`

Lista **todos** os comandos disponíveis, sempre atualizada — inclui tanto
os comandos gerais quanto os individuais listados a seguir.

```bash
codesentry help
```

### Comandos individuais por regra

Cada regra nativa também tem um comando próprio, que roda **só ela** sobre
um diretório — útil para focar em um tipo de problema específico sem esperar
o scan completo (e sem o Semgrep, que só roda como parte de `scan`). Todos
seguem o mesmo formato:

```bash
codesentry <comando> [path] [--json] [--tests]
```

Alguns exemplos:

```bash
codesentry long-functions .          # funções com mais de 30 linhas
codesentry no-eval ./src             # uso de eval()
codesentry xss ./src --json          # possíveis XSS (innerHTML, document.write, dangerouslySetInnerHTML)
codesentry unsafe-sql ./src          # SQL injection por concatenação
codesentry command-injection ./src   # child_process com entrada não sanitizada
codesentry weak-hash-algorithm ./src # uso de MD5/SHA-1 para hashing sensível
codesentry dependency-audit .        # `npm audit` das dependências do projeto (sem --tests: não lê arquivos-fonte)
```

Assim como em `scan`, `--tests` inclui arquivos de teste na análise (por
padrão são ignorados) — exceto em `dependency-audit`, que nunca lê
arquivos-fonte e por isso não tem essa flag.

A lista completa (30+ comandos, um por regra) sai de `codesentry help` —
mantê-la sempre em sincronia aqui manualmente não seria viável.

### `codesentry init`

Assistente interativo para configurar o CodeSentry no projeto atual.

```bash
codesentry init
```

> A persistência da configuração em arquivo ainda não está implementada
> (ver `src/config/config.ts`).

## Desenvolvimento

```bash
npm install       # instala as dependências
npm run dev        # roda a CLI direto do TypeScript (via tsx)
npm run build      # gera o build de produção em dist/
npm run typecheck  # checagem de tipos (tsc --noEmit)
npm test           # roda a suíte de testes uma vez
npm run test:watch # roda os testes em modo watch
```

Este projeto segue **TDD obrigatório**: toda nova regra, comando ou
comportamento do scanner/reporter deve começar por um teste que falha,
em `tests/`, antes de qualquer implementação.

Para entender a estrutura de pastas e o fluxo de dados
(`command → scanner → rules → reporter`), veja
[docs/architecture.md](docs/architecture.md). Para o racional por trás
das bibliotecas usadas na CLI, veja
[docs/adr/0001-cli-libs.md](docs/adr/0001-cli-libs.md).

## Licença

[MIT](LICENSE)
