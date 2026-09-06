# CodeSentry

CLI de verificação de vulnerabilidades e qualidade de código. O scanner
combina regras próprias para JavaScript/TypeScript e o ruleset OWASP do
Semgrep CE para as linguagens suportadas por ele.

## Instalação

Em uma release publicada, basta uma instalação:

```bash
npm install -g codesentry
```

O pacote compatível de Semgrep CE e Python portátil é instalado como
dependência opcional automaticamente. Não é necessário instalar Python,
Docker, Semgrep, criar conta ou autenticar em um site.

As plataformas inicialmente suportadas são Linux x64 e Windows x64. Os
pacotes têm tamanho de dezenas de MB porque incluem o runtime; essa é a troca
para o scan funcionar offline após a instalação. Durante o desenvolvimento,
use `npm link`:

```bash
git clone <url-do-repositorio>
cd CodeSentry
npm install
npm run build
npm link
```

Depois disso, o comando `codesentry` fica disponível em qualquer
diretório do seu terminal.

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

Em macOS, ARM e plataformas sem runtime publicado, o comando interrompe
explicitamente em vez de declarar uma análise parcial como completa.

### `codesentry rules`

Lista as regras de análise disponíveis.

```bash
codesentry rules
```

### `codesentry long-functions [path]`

Analisa um diretório (padrão: diretório atual) em busca apenas de
funções com mais de 30 linhas (severidade `low`). Essa mesma regra
também roda automaticamente como parte do `codesentry scan`.

```bash
codesentry long-functions .
codesentry long-functions ./src --json
```

### `codesentry help`

Lista os comandos disponíveis.

```bash
codesentry help
```

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
