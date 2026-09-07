<p align="center">
  <img src="https://raw.githubusercontent.com/Ivan-ReisDev/code-sentry/main/docs/assets/logo.png" alt="Logo do CodeSentry" width="480">
</p>

# codesentry-semgrep-rules

Pacote interno do [CodeSentry](https://github.com/Ivan-ReisDev/code-sentry) —
uma CLI de verificação de vulnerabilidades e qualidade de código para
JavaScript/TypeScript, com cobertura OWASP multi-linguagem via Semgrep CE
embutido.

## O que tem aqui dentro

Um snapshot local, fixado por versão, do ruleset público
[`p/owasp-top-ten`](https://semgrep.dev/p/owasp-top-ten) do Semgrep —
mais de 550 regras cobrindo o OWASP Top 10 em dezenas de linguagens
(JS/TS, Python, Java, Go, Ruby, PHP e outras).

Este pacote é baixado **uma única vez**, durante a preparação de cada
release do CodeSentry — nunca em tempo de instalação do usuário final, e
nunca durante o `codesentry scan`. O SHA-256 do conteúdo fica registrado em
`rules/ruleset.lock.json`, publicado junto. Isso é o que permite ao
`codesentry` rodar 100% offline, sem consultar a Semgrep Registry nem
enviar métricas — ver [ADR 0004](https://github.com/Ivan-ReisDev/code-sentry/blob/main/docs/adr/0004-bundled-semgrep-runtime.md)
para o racional completo.

`codesentry` depende deste pacote como dependência regular (não opcional,
diferente dos runtimes por plataforma) — ele é sempre instalado junto,
independente do sistema operacional.

## Não é para instalação direta

Se você quer usar o CodeSentry, instale o pacote principal:

```bash
npm install -g codesentry
codesentry scan .
```

Veja o [README do CodeSentry](https://github.com/Ivan-ReisDev/code-sentry#readme)
para o que a ferramenta faz, como instalar no Windows/Linux e a lista
completa de comandos.

## Licença

O ruleset distribuído aqui é de terceiros — veja
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). O código deste pacote é
[MIT](./LICENSE).
