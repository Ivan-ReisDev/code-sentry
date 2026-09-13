# ADR 0006: NVD API 2.0 como enriquecimento dos findings OSV

- **Status:** Aceito
- **Data:** 2026-09-13

## Contexto

A ADR 0005 integrou o OSV.dev à auditoria de dependências, mas condensava os
dados num texto e eliminava todo resultado OSV quando o `npm audit` marcava o
mesmo nome de pacote. Isso impedia correlação confiável por CVE e ocultava
detalhes úteis do NVD, como CVSS, CWE, referências e dados da CISA.

O objetivo desta evolução não é transformar o NVD em um segundo detector. O
OSV continua responsável por identificar a combinação pacote/versão
vulnerável e por informar versões corrigidas. A NVD API 2.0 é consultada apenas
para CVEs presentes em `aliases` do resultado OSV.

## Decisão

1. Estender `RuleFinding` com metadata opcional `dependency`, preservando os
   cinco campos públicos existentes e a compatibilidade da saída JSON.
2. Extrair aliases que correspondam exatamente a `CVE-ano-número`, normalizar
   para uppercase e deduplicar dentro do advisory e globalmente no scan.
3. Consultar uma única vez cada CVE distinto e reanexar o resultado aos
   findings que o referenciam.
4. Representar o lookup por uma união discriminada: `found`, `not-found` ou
   `error`. Falha do NVD nunca remove nem impede a emissão do finding OSV.
5. Selecionar CVSS na ordem v4.0, v3.1, v3.0 e v2. Dentro da versão escolhida,
   preferir NVD Primary, outra fonte Primary, outra métrica NVD e então a
   primeira métrica válida.
6. A maior severidade NVD válida entre os CVEs prevalece no finding. Na
   ausência dela, manter a severidade OSV.
7. Deduplicar npm/OSV apenas quando o mesmo pacote tiver interseção comprovada
   entre IDs CVE/GHSA. Nome do pacote ou similaridade de título não bastam.

Esta decisão revoga especificamente o trecho da ADR 0005 que declarava o npm
autoritativo por nome de pacote. Os demais pontos daquela ADR continuam
válidos.

## Transporte e resiliência

O cliente NVD usa `fetch`, timers, `AbortSignal` e filesystem nativos do Node
22, sem nova dependência. A chave opcional vem de `NVD_API_KEY`, após `trim`, e
é enviada somente no header `apiKey`.

- Concorrência efetiva 1, com intervalo mínimo entre o início de todas as
  tentativas: 6,1 s sem chave e 610 ms com chave.
- Timeout de 10 s por tentativa e no máximo três tentativas.
- Retry somente para HTTP 408, 429, 5xx, timeout e falha transitória de rede,
  com backoff exponencial de 1 s/2 s, jitter de 20% e respeito a `Retry-After`.
- HTTP 404 significa `not-found`; outros 4xx são permanentes. 401/403 abrem o
  circuito, assim como um 429 esgotado ou três CVEs consecutivos com falha
  transitória.
- Erros expostos usam apenas categorias locais. Chave, headers, corpo bruto e
  mensagem original do transporte não são propagados.

## Cache

O cache persistente contém somente resultados normalizados e usa
`schemaVersion: 1`. Registros encontrados expiram em 24 horas; `not-found`, em
1 hora; erros não são persistidos. A escrita usa arquivo temporário e rename.
Cache ausente, corrompido ou sem permissão vira cache miss e aviso, sem abortar
o scan.

O local segue a plataforma:

- Linux: `$XDG_CACHE_HOME/codesentry/nvd-v1.json` ou
  `~/.cache/codesentry/nvd-v1.json`.
- macOS: `~/Library/Caches/CodeSentry/nvd-v1.json`.
- Windows: `%LOCALAPPDATA%/CodeSentry/nvd-v1.json`.

## Modelo e relatórios

O normalizador mantém datas como strings, prefere descrição em inglês,
deduplica CWE e referências, preserva as semânticas distintas de CVSS v2/v3/v4
e separa CISA KEV de CISA SSVC. Propriedades futuras desconhecidas são
ignoradas; campos opcionais ausentes não são inventados.

Console e Markdown exibem dependências em blocos estruturados. O JSON continua
contendo `ruleId`, `message`, `file`, `line` e `severity`, acrescido apenas de
`dependency` quando aplicável. `engines.nvd` registra `total`, `enriched`,
`notFound`, `failed` e `cacheHits`; `false` registra desativação por
`--no-nvd`.

## Consequências

- O primeiro scan sem chave pode ser lento por causa do pacing público; cache
  e chave opcional reduzem execuções subsequentes.
- CVEs recentes podem existir sem análise ou CVSS. Isso é um resultado válido,
  distinto de ausência no NVD e de falha de consulta.
- O schema NVD pode evoluir. O parser valida somente os campos consumidos e
  precisa de fixtures e testes separados para cada geração CVSS.
- O cache troca atualização imediata por estabilidade e respeito ao rate
  limit; seus TTLs são deliberadamente curtos para dados negativos.
