# ADR 0005: Suporte a macOS (arm64 e x64) no runtime Semgrep embutido

- **Status:** Aceito
- **Data:** 2026-09-10

## Contexto

Até a versão 0.1.11, o runtime Semgrep embutido era publicado apenas para
Linux x64 e Windows x64 (ver [ADR 0004](0004-bundled-semgrep-runtime.md)). Em
qualquer outra plataforma, incluindo macOS, o `codesentry scan` encerrava
explicitamente, sem cobertura OWASP. Como boa parte do público de
desenvolvimento usa macOS, tanto Apple Silicon quanto Intel, essa lacuna
deixava a ferramenta inutilizável nessas máquinas.

O motor nativo (Babel/ESLint) sempre rodou em qualquer plataforma; o que
faltava era o runtime portátil (CPython + Semgrep CE) para macOS. O Semgrep
CE 1.145.0, versão já fixada no pipeline, publica wheels para as duas
arquiteturas de macOS (`macosx_11_0_arm64` e `macosx_10_14_x86_64`), então a
mesma receita de build usada em Linux e Windows se aplica ao macOS sem mudar
a lógica de instalação.

## Decisão

Publicar dois novos pacotes opcionais por plataforma:
`codesentry-semgrep-darwin-arm64` (Apple Silicon) e
`codesentry-semgrep-darwin-x64` (Intel). Cada um contém CPython portátil,
Semgrep CE e suas dependências, com o mesmo layout POSIX do pacote Linux
(`runtime/python/bin/semgrep`, shebang `#!/usr/bin/env python3`).

O pacote principal passa a mapear `darwin/arm64` e `darwin/x64` para esses
pacotes em `packageForPlatform` (`src/scanner/semgrep-runtime.ts`), e a
mensagem de plataforma não suportada passa a listar o macOS. Os dois pacotes
entram como `optionalDependencies`; os filtros `os`/`cpu` de cada um garantem
que o npm instale só o compatível com a máquina do usuário.

O pipeline de release (`.github/workflows/release.yml`) ganha duas pernas de
matriz: `macos-14` para arm64 e `macos-13` para Intel. O passo de build é o
mesmo das outras plataformas (uv + pip + reescrita de shebang), pois o macOS
usa o mesmo caminho de texto do Linux para o shebang.

## Consequências

- Plataformas suportadas passam a ser Linux x64, Windows x64, macOS arm64 e
  macOS x64. Plataformas sem runtime publicado (por exemplo Linux ARM ou
  Windows ARM) continuam encerrando o scan explicitamente, como antes.
- A perna Intel (x64) depende do runner `macos-13`, a última imagem macOS
  Intel dos GitHub Actions, que a plataforma vem descontinuando. Se ela sair
  de disponibilidade, a arm64 (M1 ou mais recente) segue publicável e a x64
  fica pendente de um runner alternativo.
- Cada release publica agora quatro pacotes de runtime em vez de dois, com o
  mesmo custo de revisão de licenças e registro de versões/checksums
  (`runtime.lock.json`) por plataforma.
- A versão foi elevada para 0.1.12 em lockstep entre o CLI, o pacote de
  regras e todos os pacotes de runtime, para que as `optionalDependencies`
  fixadas resolvam os pacotes darwin recém-publicados.
