<p align="center">
  <img src="https://raw.githubusercontent.com/Ivan-ReisDev/code-sentry/main/docs/assets/logo.png" alt="Logo do CodeSentry" width="480">
</p>

# codesentry-semgrep-win32-x64

Pacote interno do [CodeSentry](https://github.com/Ivan-ReisDev/code-sentry).
Contém um runtime Python portátil com o Semgrep CE instalado, usado
automaticamente como dependência opcional em máquinas Windows x64 — é assim
que o `codesentry` roda o Semgrep sem exigir Python, Docker ou instalação
manual do Semgrep pelo usuário.

**Não é para instalação direta.** Se você quer usar o CodeSentry, instale o
pacote principal:

```bash
npm install -g codesentry
```

O npm resolve este pacote automaticamente na sua plataforma. Veja o
[README do CodeSentry](https://github.com/Ivan-ReisDev/code-sentry#readme)
para o que a ferramenta faz e como usar.

## Licença

Este pacote distribui Semgrep CE e CPython — veja
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). O código deste pacote é
[MIT](./LICENSE).
