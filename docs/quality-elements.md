# Pétalas, gelo e chuva na transmissão — 05/11/2026

> Estudo histórico encerrado em 06/11/2026. Os efeitos e seus módulos de runtime foram removidos a pedido do usuário. Preparação e transmissão usam agora o [oceano com tubarões](quality-ocean.md).

Revisão de 06/11: o [gelo fragmentado e a refração](ice-refinement-study.md)
substituíram os flocos de seis braços e acrescentaram alvo RGBA8 e terceiro draw.
Pétalas com superfície curva e dinâmica reduzida estão
descritas ao final. As contagens de geometria/buffer e o diagnóstico de quads
nas seções originais abaixo registram a primeira versão, substituída nesta revisão.

Cena local para os três perfis de imagem durante a transmissão, aprovada como
interpretação de Senbonzakura, Hitsugaya e Unohana. Os rótulos continuam Nítida,
Fluida e Leve. O oceano ASCII permanece na preparação; a proposta anterior de
membranas holográficas foi substituída por esta direção a pedido do usuário.

## Performance e viabilidade

`public/quality-elements.mjs` usa um contexto WebGL2 com dois programas e duas
chamadas por quadro: fundo analítico e quads instanciados com formas SDF. A
população total é fixa: 174 no desktop e 108 com cards empilhados. Um buffer de
8.352 bytes é alocado uma vez e atualizado por quadro; um VAO descreve as três
entradas vec4. Não há texturas, framebuffer intermediário, bloom, import Three.js,
modelos ou leituras de layout no loop. A composição usa transparência convencional,
sem ordenação volumétrica ou simulação de fluidos.

Raster limitado a 240 mil pixels, DPR 1,5 e dimensão máxima de 1536. O trabalho
de fragmentos das partículas depende da cobertura e sobreposição dos quads;
esses limites não são benchmark de GPU, VRAM ou garantia de 60 fps. A atualização
tem teto aproximado de 60 quadros por segundo. O oceano continua com seus próprios
limites (360 mil pixels e alvo por célula); os dois renderizadores não coexistem.

Aba oculta, grupo fora da tela ou escolha de fonte pausam o RAF. O relógio para
durante a pausa e recomeça sem saltar pelo tempo oculto. Movimento reduzido,
cores forçadas, shader/contexto indisponível deixam os controles nativos com
fundos estáticos. Pagehide, descarte e troca de modo liberam os programas, VAO e
buffer; restauração de contexto recria os recursos.

## Referências e interpretação

- [Personagens de Bleach, site oficial](https://bleach-anime.com/character/).
- [Gommage, Codrops](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/): referência de dobra, giro e poeira. A implementação daquele estudo é WebGPU/TSL, não foi incorporada ao projeto.
- [Curl noise, Bridson e colaboradores](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf): referência para campos turbulentos procedurais. Aqui o curl analítico de uma função de corrente de duas ondas fornece um deslocamento limitado; não se afirma que as trajetórias analíticas integrem a advecção incompressível do artigo.
- [GPU Gems: partículas e overdraw](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles): fundamento para limitar cobertura e transparências. O render offscreen proposto pelo capítulo não é usado neste efeito.

Formas, materiais e composição são autorais, sem frames, modelos ou áudio do anime.
São quads iluminados com aparência de volume (2,5D), não pétalas volumétricas nem
um modelo físico de neve, sangue ou tecido.

## Arquitetura e movimento

`public/quality-flow.mjs` agora é o controlador compartilhado. Ele mede o grupo
e os três retângulos em eventos de layout e muda entre `ascii-ocean` e
`live-elements` conforme o estado do host. Há um canvas decorativo e o fieldset
original acompanha preparação/transmissão sem perder preferência, foco ou eventos.

Uma população principal percorre o espaço comum. Identidade, posição, giro,
profundidade e fase são contínuos entre janelas. Nos limites físicos dos cards,
uma faixa suave interpola os campos de distância, a escala e a iluminação de
pétala para cristal e de cristal para gota. O peso de sangue aumenta o alongamento
e a queda. O wrap do percurso acontece fora das janelas, com opacidade zero.

Populações locais completam o ambiente: pétalas maiores, poeira de gelo com
alguns flocos de seis braços, chuva vertical e anéis elípticos que crescem e
desaparecem na superfície vermelha. O banho de luz e o padrão de superfície do
fundo são calculados por pixel; as formas pequenas são desenhadas apenas nos
quads. As trajetórias principais são horizontais no desktop e verticais quando
os cards estão empilhados. As famílias locais continuam dentro da sua janela.

O ponteiro passa por um filtro temporal e altera posição/giro nas proximidades.
Touch não ativa esse estado. A seleção por mouse ou teclado emite uma onda curta
e altera a ênfase; a escolha funcional continua síncrona com o controle HTML.

Os cards ao vivo têm 192 px de altura no desktop e 160 px no layout compacto,
com rótulos na faixa inferior protegida por shader e véu CSS. Acentos rosa, azul
frio e vermelho acompanham os respectivos materiais. Não se altera o fluxo de
captura, os perfis de bitrate, os apelidos, o player ou a plateia.

## Verificação

Testes numéricos: população/raster limitados, pesos complementares, continuidade
da mesma identidade entre três matérias, resets invisíveis, dados finitos,
queda da chuva e crescimento/desaparecimento dos impactos. Testes do controlador:
buffer persistente, ausência de layout por quadro, touch/ponteiro, seleção,
preferências, pausa de captura, troca de modos, contexto e bfcache.

Os testes GL usam mocks e não medem GPU. A compilação real, as formas e a
integração são verificadas separadamente no Chromium da prévia local, usando
`qa=live` com vídeo/transportes sintéticos. Aparelhos físicos, Safari/iOS, uma
transmissão real entre redes e desempenho sustentado continuam sem validação.

Validação local concluída: 126 testes, build Worker em dry-run e checagem HTTP
de seis telas e dez assets passaram. No Chromium, cards de 192 px e um canvas
894 × 268 foram observados no grupo de 640 px em desktop; em viewport de
390 px, os três cards de 160 px formaram um grupo de aproximadamente 336 ×
496 px, sem overflow horizontal. Console sem erros/avisos nessa revisão.
Clique e setas atualizaram a preferência; parar voltou ao oceano com um canvas
no grupo, e iniciar novamente trouxe as partículas. Imagens de desktop e
390 px estão em `artifacts/quality-elements/`. Não houve publicação.

## Pétalas curvas com dinâmica reduzida — 06/11/2026

Base de pesquisa e fontes: [petal-refinement-study.md](petal-refinement-study.md).
A implementação acrescenta `public/petal-dynamics.mjs`, importado diretamente
pelo renderizador de elementos. O controlador e o oceano ASCII continuam com
o ciclo de vida anterior. A escolha do radio não espera a decoração.

Cada uma das 82 identidades portadoras de pétalas no desktop (50 no compacto)
tem posição XYZ, velocidade linear, quaternion e velocidade angular. Estado em
arrays tipados, passo fixo de 1/120 s, interpolação entre estados e até oito
subpassos por atualização. O avanço recebe o relógio ativo do controlador;
pausar uma aba não acumula segundos para simular no retorno. Uma defesa adicional
limita catch-up caso o renderizador seja chamado com um salto de tempo.

O campo de ar combina derivadas de uma função de corrente, uma rajada espacial
que viaja no grupo e uma perturbação suave do ponteiro. A velocidade relativa
entre ar e corpo, sua normal orientada e o tamanho modulam o arrasto. Há força
normal/lift reduzida, gravidade artística, torque com amortecimento e uma força
de retorno ao percurso para manter o fluxo na faixa protegida. A maioria oscila
com inclinação limitada; uma minoria tem torque suficiente para virar sobre si.
Flexão longitudinal depende parcialmente da velocidade angular e vertical.

Isso é um modelo artístico reduzido: coeficientes não calibrados para pétalas
reais, com guia analítico e confinamento. Não é implementação das equações JFM,
não modela desprendimento de vórtices, colisões ou tecido flexível acoplado a ar.
O curl não é integrado como um solver completo de escoamento incompressível.

Todos os materiais usam uma grade 8 × 4 células (64 triângulos, 192 vértices
submetidos por instância) para conservar um único batch durante o morph. São
11.136 triângulos nas 174 instâncias de desktop ou 6.912 nas 108 compactas. As
pétalas curvam a grade em concha, com variações de curvatura e torção, e a normal
é derivada da mesma superfície e rotacionada pelo mesmo quaternion. Na passagem
para gelo a superfície retorna à projeção plana sem reiniciar a identidade.

O contorno SDF agora tem base afilada, lâmina larga, entalhe e assimetria sutil.
Pigmento pálido, nervação ramificada filtrada por derivadas, frente/verso distintos,
reflexo largo de pouca intensidade e luz posterior modulada por espessura substituem
o highlight forte anterior. A translucência é uma aproximação de iluminação,
sem ray tracing, textura fotográfica ou espalhamento volumétrico. O UV e a textura
procedural acompanham a superfície. Pontos da malha têm projeção de perspectiva,
e a evolução do Z introduz paralaxe limitada nos centros.

Uma ordenação por Z dos centros antes do upload melhora a composição de lâminas
transparentes. Não resolve a ordenação por pixel de superfícies que se cruzam.
O buffer de instâncias passa a cinco vec4 por identidade: 13.920 bytes, alocado
uma vez. Arrays persistentes guardam ordem, estado e o buffer de trabalho. Sem
novos programas, texturas, passes ou render targets: fundo + uma chamada instanciada.
Os limites de 240 mil pixels, DPR 1,5 e 1536 por dimensão permanecem. Mais vértices
e integração de corpos aumentam trabalho; essas contagens não provam 60 fps.

Testes específicos validam concordância da integração a 30/60/144 Hz, estabilidade
por 65 s nos dois layouts, normalização dos quaternions, limites de velocidade,
rajada espacial e resposta ao ponteiro sem teleporte, catch-up limitado, giro de
uma minoria e chegada exata ao percurso de gelo após congelamento completo.
O controlador também confere stride, geometria submetida e ordenação de centros,
além de recursos/preferências/pausa já cobertos. Mocks GL não são benchmark.

Validação desta revisão: 132 testes e build em dry-run passaram; verificação
HTTP de seis telas e onze assets também. No Chromium local, shaders compilados
sem avisos/erros, cards legíveis em desktop e viewport de 390 px (160 px de altura
no layout compacto), sem overflow horizontal. Clique e setas atualizaram o radio;
parar a captura sintética retornou ao oceano com um único canvas no grupo.
Registros em `artifacts/petal-refinement/`. Sem captura real, teste de GPU/fps
sustentados em aparelho físico ou publicação.
# Refinamento do sangue

O tratamento de chuva fina foi atualizado em 06/11/2026 com gotas volumosas,
impactos amortecidos e fusão curta das lascas que entram no terceiro card.
Pesquisa, arquitetura, limites e validação: [blood-refinement-study.md](./blood-refinement-study.md).
