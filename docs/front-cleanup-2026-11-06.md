# Revisão do front — 06/11/2026

O seletor de qualidade usa o mesmo oceano com tubarões na preparação e na
transmissão. Nítida recebe azul-mar, Fluida verde-esmeralda e Leve mantém o
vermelho anterior. O fieldset é movido com seus controles, renderer e preferência.

## Código e arquivos sem uso

- Os módulos dos efeitos de pétalas, gelo e chuva e os testes exclusivos deles
  foram retirados antes desta revisão; não fazem parte do conjunto publicado.
- Removidos os cálculos de retângulos em pixels do controller: o oceano usa
  somente as coordenadas CSS das três janelas.
- Removidos o uniform `time` do passe ASCII e seu envio por quadro. O tempo
  continua no passe de cena, onde anima água e tubarões.
- Removidas a variante CSS `.btn.danger` sem consumidores e as variáveis
  `--font-mono` e `--text-display`, também sem consumidores no front.
- `artifacts/` inteiro foi ignorado no Git. As capturas e pacotes locais foram
  preservados no disco e ficam fora do PR e do deploy.

## Pastas e alcance da revisão

Todos os módulos de `public/` são alcançáveis pelas páginas de host, espectador
ou link inválido, pelos imports desses módulos ou pelo worker do diorama.
`production:check` agora falha se encontrar um `.mjs` publicado sem esse caminho.
O teste também resolve imports transitivos e verifica HTTP e compilação JS.

Os parciais Sass são importados por `app.scss` ou por outros parciais ativos.
`effects/diorama/` fornece módulos, modelos e texturas usados pelo build;
`public/diorama/` é gerado novamente com limpeza dos hashes antigos.

`research/ascii-diorama/` mantém a referência e ferramentas de pesquisa
documentadas. `scripts/player-smoke-server.mjs` é uma ferramenta de QA manual
documentada. Essas pastas não são assets publicados; os estudos encerrados em
`docs/` são registros históricos, identificados como tal.

A inspeção de referências e a verificação de módulos não constituem prova de
ausência de todo ramo inalcançável em JavaScript/CSS, nem medem desempenho GPU.
Não houve nova revisão visual, captura real, teste em aparelhos físicos ou deploy.

## Validação desta revisão

Passaram os 120 testes Node, o build Worker em dry-run, as seis rotas de prévia
e a validação em workerd de seis casos de página/assinatura, autenticação do
ping Discord e 24 assets/imports. A checagem de módulos publicados não encontrou
órfãos. Essas verificações são locais e não incluem uma publicação.
