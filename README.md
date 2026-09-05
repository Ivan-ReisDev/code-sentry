# CodeSentry

CLI de verificação de vulnerabilidades e qualidade de código para
projetos TypeScript/JavaScript.

## Instalação

O projeto ainda não foi publicado no npm. Durante o desenvolvimento,
use `npm link` para ter o comando `codesentry` disponível globalmente
apontando para o código local:

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
```

### `codesentry rules`

Lista as regras de análise disponíveis.

```bash
codesentry rules
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
