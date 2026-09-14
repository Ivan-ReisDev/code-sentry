# ADR 0007: auditoria de dependências multi-ecossistema (pnpm, Yarn, Python)

- **Status:** Aceito
- **Data:** 2026-09-13

## Contexto

A ADR 0005 integrou o OSV.dev à auditoria de dependências, mas o
`dependency-audit.ts` só sabe ler `package-lock.json`: `osv-client.ts` fixa
`ecosystem: 'npm'` em duas linhas (a montagem do `querybatch` e o filtro de
`extractFixedVersions`), e `package-lock-parser.ts` só entende o shape do
lockfile do npm. Qualquer projeto usando pnpm, Yarn ou Python fica com
cobertura zero — nem `npm audit`, nem OSV.dev rodam, mesmo a API do OSV.dev
sendo nativamente multi-ecossistema.

O pedido é estender a auditoria pra ler lockfiles reais (versões já
resolvidas, não manifests com ranges) de mais ecossistemas: `pnpm-lock.yaml`
e `yarn.lock` (ambos ecossistema OSV `npm` — mesmo pacote público, gerenciador
diferente) e `poetry.lock`/`requirements.txt` (ecossistema `PyPI`). Go, Maven
e NuGet ficam para uma fase futura. `pom.xml`/`.csproj` brutos ficam de fora
mesmo depois — Maven não tem lockfile nativo simples (versões podem ser
ranges/propriedades) e `packages.lock.json` do NuGet (JSON, versões
resolvidas) é a única exceção que valeria a pena tratar quando essa fase
chegar.

Durante a pesquisa, confirmamos rodando `npm audit` de verdade que ele exige
`package-lock.json`/`npm-shrinkwrap.json` — falha com `ENOLOCK` num diretório
que só tenha `pnpm-lock.yaml`/`yarn.lock`. Isso significa que um projeto
só-pnpm ou só-yarn terá cobertura só do OSV.dev, sem o complemento do npm
audit — aceito como limitação conhecida (ver Consequências).

## Opções consideradas

1. **Ferramenta autoritativa por ecossistema** (replicar o padrão
   npm-audit-primeiro da ADR 0005: `pip-audit` para Python, etc.) —
   rejeitada. O `npm` é requisito do próprio CodeSentry (`engines.node` no
   `package.json`), então está sempre disponível; `pip`/`pip-audit` não têm
   essa garantia na máquina de quem roda o scan. Depender de uma ferramenta
   que pode simplesmente não existir tornaria a cobertura inconsistente e
   imprevisível.
2. **Forçar `npm audit --package-lock=false`** quando só há
   `pnpm-lock.yaml`/`yarn.lock` — rejeitada. Isso dispara uma resolução
   completa contra o registry (rede pesada) e ignora o que o pnpm/Yarn
   realmente instalou, podendo reportar vulnerabilidades em versões que o
   projeto nem usa.
3. **OSV.dev como única fonte para os ecossistemas novos**, mantendo `npm
audit` exatamente como hoje (só quando há lockfile npm de verdade) —
   escolhida. Simples, sem depender de ferramentas externas não garantidas,
   e já é estritamente melhor que a cobertura zero atual.

Para o parsing em si, cada formato teve sua biblioteca avaliada
individualmente — ver tabela na Decisão.

## Decisão

| Componente                                                                | Papel                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scanner/lockfiles/locked-package.ts` (novo)                          | Tipo `LockedPackage` unificado (`name`, `version`, `ecosystem`, `lockfile`) — todo parser de lockfile produz esse shape.                                                                                                                                             |
| `src/scanner/lockfiles/pypi-name.ts` (novo)                               | Normalização de nome PyPI conforme PEP 503, usada pelos parsers Python e pelo filtro de correspondência do OSV.                                                                                                                                                      |
| `src/scanner/lockfiles/package-lock-parser.ts` (movido de `src/scanner/`) | npm — inalterado na lógica, só ganha os campos `ecosystem: 'npm'` e `lockfile`.                                                                                                                                                                                      |
| `src/scanner/lockfiles/pnpm-lock-parser.ts` (novo)                        | pnpm — YAML (`lockfileVersion` 5/6/9), via biblioteca `yaml`.                                                                                                                                                                                                        |
| `src/scanner/lockfiles/yarn-lock-parser.ts` (novo)                        | Yarn — detecta Classic (v1, formato próprio, parser feito à mão) vs Berry (v2+, YAML válido, reaproveita a mesma biblioteca `yaml`).                                                                                                                                 |
| `src/scanner/lockfiles/poetry-lock-parser.ts` (novo)                      | Python/Poetry — TOML, via biblioteca `smol-toml`.                                                                                                                                                                                                                    |
| `src/scanner/lockfiles/requirements-txt-parser.ts` (novo)                 | Python/pip — regex, só linhas com pin exato `nome==versão`; ranges/não fixadas são ignoradas silenciosamente (não são lockfile de verdade).                                                                                                                          |
| `src/scanner/lockfiles/lockfile-discovery.ts` (novo)                      | Procura os 5 nomes de arquivo suportados em `targetDir`, parseia todos os presentes (projeto poliglota é válido), deduplica por `ecosystem:nome@versão`, nunca lança — erro de parse vira aviso por arquivo.                                                         |
| `src/scanner/osv-client.ts` (estendido)                                   | `OsvPackageQuery.ecosystem` deixa de ser o literal `'npm'` e passa a ser um campo real; `extractFixedVersions` recebe o ecossistema como parâmetro em vez de comparar contra `'npm'` hardcoded.                                                                      |
| `src/scanner/dependency-audit.ts` (estendido)                             | `runNpmAudit` só executa quando há `package-lock.json`/`npm-shrinkwrap.json`; toda chave de dedup/lookup passa a incluir o ecossistema (`${ecosystem}:${name}@${version}`), corrigindo uma colisão latente entre pacotes de nomes iguais em ecossistemas diferentes. |

**Bibliotecas novas avaliadas:**

| Formato                       | Escolha                                                                                                                    | Alternativas rejeitadas                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm-lock.yaml` + Yarn Berry | `yaml` (eemeli) — ESM puro, tipos próprios, YAML 1.2, cobre os dois formatos numa só dependência                           | `js-yaml` — CJS-first, tipos num pacote `@types` separado                                                                                                                                                                            |
| `poetry.lock`                 | `smol-toml` — ESM puro, zero dependências, TOML 1.0                                                                        | `@iarna/toml` (CJS-first, efetivamente sem manutenção); parser feito à mão (rejeitado — `poetry.lock` tem strings multi-linha e tabelas inline, ordem de magnitude mais complexo que os parsers JSON/regex já existentes no projeto) |
| Yarn Classic (v1)             | Parser feito à mão (sem dependência nova) — formato regular o bastante (blocos `"spec":\n  version "x"\n  resolved "..."`) | `@yarnpkg/lockfile` — CJS, sem atualização desde 2020, traz runtime do Babel                                                                                                                                                         |
| `requirements.txt`            | Regex/linha a linha (sem dependência nova)                                                                                 | —                                                                                                                                                                                                                                    |

Net: duas dependências novas em runtime (`yaml`, `smol-toml`), ambas
ESM-puras e empacotadas pelo `tsup` — sem mudança na instalação do usuário
final.

## Consequências

- Projetos só-pnpm ou só-yarn (sem `package-lock.json`/`npm-shrinkwrap.json`)
  têm cobertura só do OSV.dev — o `npm audit` não roda nesse caso. Isso é
  estritamente melhor que a cobertura zero de hoje, mas fica documentado como
  limitação conhecida no README.
- `requirements.txt` sem nenhuma linha com pin exato (`==`) produz zero
  pacotes auditados — um aviso avisa que nada foi checado, em vez de deixar o
  usuário achar que a ausência de findings significa "sem vulnerabilidades".
- Sem recursão em monorepo e sem suporte a `Pipfile.lock`/`uv.lock`/`pdm.lock`
  nesta fase — só o diretório raiz do alvo do scan é verificado, mesmo padrão
  que `package-lock.json` já tinha.
- `pnpm-lock.yaml` pode evoluir de formato (v5/v6/v9 já têm shapes de chave
  diferentes); uma versão desconhecida degrada para zero pacotes + aviso, não
  para erro — mesmo espírito do gap já documentado na ADR 0005 para
  `lockfileVersion` 1 do npm.
- `ScanResult`/`ScanEngines` continuam achatados (contagens somadas entre
  ecossistemas) — sem detalhamento por ecossistema nesta fase; `Dependency
audit: N pacote(s) considerado(s)` no console passa a significar "em todos
  os ecossistemas encontrados", não só npm.
