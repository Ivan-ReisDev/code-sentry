<p align="center">
  <img src="https://raw.githubusercontent.com/Ivan-ReisDev/code-sentry/main/docs/assets/logo.png" alt="Logo do CodeSentry" width="480">
</p>

# codesentry-semgrep-linux-x64

Pacote interno do [CodeSentry](https://github.com/Ivan-ReisDev/code-sentry) —
uma CLI de verificação de vulnerabilidades e qualidade de código para
JavaScript/TypeScript, com cobertura OWASP multi-linguagem via Semgrep CE
embutido.

## O que tem aqui dentro

Um runtime completo e autocontido para Linux x64:

- **Python 3.12** portátil (compilado standalone, sem depender do Python
  do sistema)
- **Semgrep CE 1.145.0** já instalado nesse Python, pronto para rodar

Isso é ~100 MB porque é uma instalação Python completa, não um script —
essa é a troca deliberada para o `codesentry scan` rodar cobertura OWASP
completa sem exigir Python, Docker, Semgrep ou qualquer conta/autenticação
por parte de quem instala. O racional completo está no
[ADR 0004](https://github.com/Ivan-ReisDev/code-sentry/blob/main/docs/adr/0004-bundled-semgrep-runtime.md).

`codesentry` resolve este pacote como **dependência opcional**, e o npm só
o instala em máquinas Linux x64 (`os`/`cpu` no `package.json` filtram isso
automaticamente) — em outras plataformas ele nunca é baixado.

## Não é para instalação direta

Se você quer usar o CodeSentry, instale o pacote principal — o npm resolve
este runtime sozinho, de acordo com a sua plataforma:

```bash
npm install -g codesentry
codesentry scan .
```

Veja o [README do CodeSentry](https://github.com/Ivan-ReisDev/code-sentry#readme)
para o que a ferramenta faz, como instalar no Windows/Linux e a lista
completa de comandos.

## Licença

Este pacote distribui Semgrep CE e CPython — veja
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). O código deste pacote é
[MIT](./LICENSE).
