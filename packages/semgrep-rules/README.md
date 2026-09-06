# codesentry-semgrep-rules

Pacote interno do [CodeSentry](https://github.com/Ivan-ReisDev/code-sentry).
Contém um snapshot local, fixado por versão, do ruleset `p/owasp-top-ten`
do Semgrep — usado automaticamente pelo `codesentry` como dependência,
sem consultar a Semgrep Registry em tempo de scan.

**Não é para instalação direta.** Se você quer usar o CodeSentry, instale o
pacote principal:

```bash
npm install -g codesentry
```

Veja o [README do CodeSentry](https://github.com/Ivan-ReisDev/code-sentry#readme)
para o que a ferramenta faz e como usar.

## Licença

O ruleset distribuído aqui é de terceiros — veja
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). O código deste pacote é
[MIT](./LICENSE).
