# Chuva de sangue e passagem do gelo — 06/11/2026

> Estudo histórico encerrado em 06/11/2026. Os efeitos e seus módulos de runtime foram removidos a pedido do usuário. Preparação e transmissão usam agora o [oceano com tubarões](quality-ocean.md).

Pedido: preservar a chuva e dar mais corpo, peso e viscosidade percebida ao
sangue, incluindo os fragmentos de gelo que entram no terceiro card.
Pesquisa e código autorizados juntos. Experimento local, sem publicação.

## 1. Performance e viabilidade

Continua um contexto WebGL2 com três draws: atmosfera para RGBA8, cópia do fundo
e batch instanciado. Mesmo alvo de até 240 mil pixels, 174 instâncias no desktop
e 108 no layout empilhado; nenhum novo alvo, textura ou programa. Novo módulo
local sem dependências de runtime. As trajetórias são analíticas e o buffer de
instâncias continua reutilizado; não há busca de vizinhos ou colisões O(n²).

O custo acrescentado está no fragment shader: silhueta suave, normal aproximada,
absorção RGB e reflexos. Os impactos têm cinco satélites analíticos por instância,
em área pequena. Os cálculos de material molhado só são solicitados quando há
peso de sangue. Isso é viável como direção para o componente real, mas ainda
não é benchmark ou garantia de 60 fps em hardware médio. Não se adicionou um
solver Navier–Stokes, FLIP, reconstrução 3D de superfície ou blur de tela inteira.

Recursos centrais de WebGL2 e fallback existente. Pausa fora da tela/aba oculta,
movimento reduzido, cores forçadas, seleção de captura e descarte continuam sob
o controlador existente. Safari e GPUs de celulares físicos não foram medidos.

## 2. Referências e contexto

[Lucas Bebber, Rain & Water Effect Experiments, Codrops, 2015](https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/)
descreve a leitura de gotas reais, volumes por mapas de normais, refração e
coalescência; distingue gotas grandes/pequenas e discute o custo de interações
e resolução. O conteúdo foi encontrado no resultado primário indexado, pois
abrir a página retornou 403. Nosso shader é procedural e original: não usa os
sprites, algoritmo de coalescência, refração de vidro ou assets da demonstração.

[Yokoyama, Tanaka e Tagawa, 2022](https://arxiv.org/abs/2201.06673) comparam o
impacto de sangue e simulantes em vidro, incluindo deformabilidade das células,
expansão e estruturas de dedos no splash. O resumo primário foi lido. Não se
generaliza uma constante de viscosidade para qualquer sangue, nem o resultado
de vidro sólido para a nossa superfície líquida fictícia. A pesquisa orienta
os sinais visuais; os impactos implementados não reproduzem aquele experimento.

[Fluid Glass, Exo Ape, Awwwards, 07/05/2026](https://www.awwwards.com/fluid-glass-case-study.html)
foi lido no navegador após timeout do extrator. A equipe descreve estudos
renderizados de timing, easing e resposta em componentes, dentro de uma direção
contida e voltada ao material. É referência de processo e acabamento, **não**
um case de simulação de sangue ou uma fonte deste shader. O nome Fluid Glass
não indica que tenham usado uma simulação de fluidos. Não se atribui nossa
arquitetura à Exo Ape nem se afirma premiação específica não verificada.

O que diferencia nossa direção de uma chuva vermelha genérica: duas escalas de
corpos arredondados, centro absorvente e reflexo molhado; aceleração legível;
impactos ligados a gotas identificáveis; gelo chegando com forma própria e se
transformando. São escolhas artísticas fundamentadas nas técnicas acima.

## 3. Arquitetura e hipóteses

`public/blood-material.mjs` separa trajetórias e blocos GLSL. O renderer existente
integra esse material com os anteriores, mantendo um canvas e rádios nativos.

### Gotas e peso percebido

Cada identidade tem duração e dimensão estáveis. Uma trajetória quadrática
produz aceleração para baixo; não se assume que mais viscosidade aumenta a
gravidade ou determina isoladamente a velocidade de queda. As gotas maiores
têm dimensão nominal de 5,2–6,7 CSS px no semieixo do quad, e as menores 2,2–3,7;
a silhueta ocupa apenas parte dele. A extensão vertical varia com a fase de
queda. O pescoço é curto e o corpo inferior é arredondado, com união suave de
duas distâncias elípticas, evitando o ícone de lágrima com ponta rígida.

Normais reconstruídas aproximadamente a partir da seção arredondada produzem
um reflexo largo e uma faixa de luz. Uma espessura aproximada alimenta absorção
exponencial com pigmento RGB dirigido. Não é malha líquida 3D, óptica espectral,
refração do vídeo/DOM nem modelo de reologia calibrado. Centro escuro e película
mais clara sugerem massa e superfície molhada sem transformar todo o corpo em
emissão vermelha. A chuva totalmente líquida deixa de responder ao vento do
ponteiro, preservando a posição de chegada.

### Impacto e superfície

Cada um dos 10/6 impactos segue uma gota específica entre as 52/34 gotas locais.
Ao encerrar uma queda, a fase seguinte ancora o impacto na posição de chegada
da **queda anterior**, não na posição atual da próxima gota. Expansão exponencial
desacelera; opacidade decai; cinco satélites descrevem arcos curtos; o centro
forma uma película e o contorno uma borda molhada irregular. São sinais de splash
dirigidos, não conservação de volume ou coalescência entre gotas independentes.
O fundo fornece uma superfície escura ondulada com reflexos fragmentados.

### Gelo entrando no sangue

A família de lascas locais ultrapassava a própria janela mantendo `blood=0`.
Agora o centro da lasca, ao entrar na região do terceiro card, inicia uma
transição de 32 CSS px: preserva leitura de gelo no início, perde a refração,
ganha pigmento e arredonda sua forma; a trajetória também desce suavemente.
Essa região usa a borda física do terceiro card, horizontal ou vertical. As
partículas principais continuam atravessando os três materiais. Não há mudança
aleatória por frame, corte instantâneo na borda ou alegação de calor latente.

## 4. Validação

138 testes passaram, incluindo aceleração, determinismo, estabilidade numérica,
chegada/impacto e os estágios da entrada do gelo. Os testes existentes continuam
cobrindo recursos GPU, buffer reutilizado, mudanças de cena, pausa e descarte.
Mocks não validam aparência, ótica ou performance. Build Wrangler em dry-run
aprovado. HTTP: seis telas, JavaScript inline e 13 assets locais aprovados.

Revisão Chromium com transmissão sintética: shaders renderizaram sem erros ou
avisos na página standalone. Conferidos desktop e iframe externo de 390 px,
com área útil/scrollWidth de 375 px e cards empilhados de 160 px nominais.
Sem overflow horizontal. A largura temporária do índice de prévias foi revertida.
Os registros visuais ficam em `artifacts/blood-refinement/`. Captura real,
performance de hardware médio e Safari/mobile físicos permanecem não validados.
