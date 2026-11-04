# Refino do player: referências e implementação

Pesquisa e revisão em 03/11/2026. Escopo aprovado: tela cheia, resposta ao toque, áudio, volume, primeira imagem, reconexão, Miniatura e acabamento estático.

## 1. Performance e viabilidade

A proposta usa CSS, SVGs pequenos e eventos de mídia. Não acrescenta biblioteca, canvas de produção, textura, WebGL ou loop JavaScript por quadro. Não há draw calls WebGL deste refino. CPU: atualizações por ação/evento e um callback por nova fonte. GPU/memória: composição de opacidade e transformações em áreas pequenas; a alocação de camadas é decisão do navegador. O preenchimento do volume e as mudanças de cor podem repintar uma área local.

O vídeo continua responsável pelo custo principal de decodificação. Não foi medido FPS, memória ou GPU em Android físico; as escolhas são viáveis para um player real, sem afirmar 60 fps universais. A base de layout usa o mesmo elemento de vídeo e os mesmos controles durante rotação, entrada em tela cheia e reconexão.

Os movimentos usam tokens de 120 ms para pressão, 180 ms para ícones/rótulos e 240 ms para revelação/mensagens. São decisões deste projeto. Movimento reduzido desativa as animações e transições; os estados continuam legíveis. Hover só acrescenta affordances em apontadores finos que o suportam. Nenhuma ação depende dele.

## 2. Referências: o que foi verificado

- **[Moxey — Awwwards](https://www.awwwards.com/sites/moxey)**: Honorable Mention de 14/02/2025, com preto e branco quente na paleta. O [player catalogado](https://www.awwwards.com/inspiration/video-player-moxey) apresenta controles, interação e transição entre os temas do elemento. A reprodução do catálogo chegou a carregar a composição com vídeo sobre fundo preto. O [estudo do desenvolvedor no Codrops, de 15/11/2024](https://tympanus.net/codrops/2024/11/15/developing-moxey-a-behind-the-scenes-look-at-the-process/) descreve um player próprio e controles ligados ao ponteiro. Aproveitamos a integração visual e a continuidade; os controles deste projeto permanecem fixos para uso por toque.
- **[Inkfish — Awwwards](https://www.awwwards.com/sites/inkfish)**: SOTD de 23/05/2024, paleta preta e branca confirmada no catálogo nesta conversa. O [player](https://www.awwwards.com/inspiration/video-player-inkfish) é identificado com scrubber e miniaturas de navegação. A referência serve à organização dos controles; essas miniaturas de navegação não são a função Picture-in-Picture do nosso projeto. Não foi determinada a implementação interna do player.
- **[Freshman — Full screen video player](https://www.awwwards.com/inspiration/full-screen-video-player-freshman)**: elemento e associação com fullscreen confirmados no Awwwards. A reprodução não ficou disponível durante a consulta; não foi possível analisar seu movimento quadro a quadro. É referência de contexto de apresentação, não evidência do nosso desenho de ícone ou de qual API o autor usou.
- **[Goodgrowth — Awwwards](https://www.awwwards.com/sites/goodgrowth)**: Honorable Mention de 07/08/2026, com abertura catalogada. O [estudo do autor no Codrops, de 27/08/2026](https://tympanus.net/codrops/2026/08/27/goodgrowth-boot-sequences-spinning-discs-and-the-art-of-the-portfolio/) fundamenta a continuidade entre estados. Essa relação visual inspira nossa espera/retomada; o artigo não documenta uma reconexão WebRTC.

Essas premiações pertencem aos sites. Não certificam isoladamente um botão, nem garantem que uma adaptação receba prêmio. O desenho dos cantos, os tempos e o comportamento de reconexão abaixo são escolhas próprias, verificadas na nossa interface.

### Correspondência de cada modificação

| Modificação | Referência Awwwards | Artigo/base técnica | Aplicação ao desenho atual |
| --- | --- | --- | --- |
| Tela cheia | [Freshman](https://www.awwwards.com/inspiration/full-screen-video-player-freshman) | [Codrops: SVG por partes](https://tympanus.net/codrops/2013/11/05/animated-svg-icons-with-snap-svg/), [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide) | Quatro cantos com transformações curtas; rótulos sobrepostos em botão de largura estável. A geometria é nossa. |
| Resposta ao toque | [Moxey: interação](https://www.awwwards.com/inspiration/mouse-interaction-moxey) | [Codrops: botões CSS](https://tympanus.net/codrops/2021/02/17/ideas-for-css-button-hover-animations/) | Superfície e conteúdo separados; comprime só o conteúdo. O artigo alerta para não cortar o foco ao recortar um botão. |
| Áudio | [Goodgrowth](https://www.awwwards.com/sites/goodgrowth) | [Estudo do autor](https://tympanus.net/codrops/2026/08/27/goodgrowth-boot-sequences-spinning-discs-and-the-art-of-the-portfolio/), [SVG por partes](https://tympanus.net/codrops/2013/11/05/animated-svg-icons-with-snap-svg/) | Ondas e sinal de silêncio mudam uma vez por ação. Mantemos o alto-falante reconhecível e a mesma espessura dos demais ícones. |
| Volume | [Inkfish: player](https://www.awwwards.com/inspiration/video-player-inkfish) | [MDN: range](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range) | Organização de controles aplicada a uma trilha de volume; preserva input nativo e mostra percentual durante foco/ajuste. Não replica o scrubber temporal. |
| Primeira imagem | [Moxey: player](https://www.awwwards.com/inspiration/video-player-moxey) | [Estudo Moxey](https://tympanus.net/codrops/2024/11/15/developing-moxey-a-behind-the-scenes-look-at-the-process/), [video frame callback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) | Continuidade por revelação curta, disparada por imagem disponível; o vídeo permanece na posição final, com proporção conservada. |
| Reconexão | [Goodgrowth: abertura](https://www.awwwards.com/inspiration/spiral-preloader-goodgrowth) | [Estudo do autor](https://tympanus.net/codrops/2026/08/27/goodgrowth-boot-sequences-spinning-discs-and-the-art-of-the-portfolio/) | Aplicamos a coerência entre estados, sem transplantar a espiral. Mensagem dentro da mesma raiz, com entrada curta e acento violeta já existente. |
| Miniatura | [Moxey: player e controles](https://www.awwwards.com/inspiration/video-player-moxey) | [MDN: Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API) | A linguagem visual do player orienta a apresentação; a função PiP é nossa, não atribuída ao Moxey. Rótulo claro e explicação acessível quando não há mídia. |

O artigo de SVG é de 2013 e usa Snap.svg. Foi consultado pelo princípio de transformar partes de um símbolo; nenhuma dependência ou código dele foi incorporado. O artigo de botões é de 2021. Eles não são apresentados como lançamentos de 2026. Para composição de movimento, a [orientação do Chrome](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion) complementa as fontes.

### Coerência visual

A paleta preta e branca de Moxey/Inkfish se aproxima da direção aprovada. Instrument Sans, os tamanhos tipográficos existentes e os espaçamentos Sass permanecem. O violeta aparece na identificação da conexão, e o conteúdo do vídeo conserva suas próprias cores. Os ícones têm grade 24×24, traço de 1,5 e tamanho visual de 18 px, dentro de alvos de 48 px. A trilha tem 2 px; seu marcador indica uma posição real e não é decoração.

O refinamento vem da consistência entre proporção, resposta e estado. A comparação entre variações nesta tela é julgamento visual; não há uma regra oficial do Awwwards que comprove uma aparência "premium".

## 3. Arquitetura e pontos difíceis

### Controles estáveis

`_player.scss` conserva a barra fora da área de corte do vídeo. O botão de tela cheia mede 8,5 rem no desktop; desde a revisão de 04/11/2026 ele usa um alvo de 3 rem com ícone abaixo de 40 rem. Os rótulos do desktop se sobrepõem em um grid, sem alterar a largura ao mudar para Voltar. O hit target não se move no hover ou na pressão.

Os cantos do SVG giram em torno dos próprios centros ao mudar para tela cheia. No hover suportado, cada canto se desloca uma unidade para fora. Ondas e sinal de silêncio usam opacidade/transform; não existe animação contínua sugerindo atividade de áudio fictícia. A pseudo-superfície do botão responde ao toque sem cortar seu contorno de foco.

### Volume e Miniatura

O range mantém interação, limites, passo e teclado nativos. `volumechange` sincroniza a posição, o preenchimento e o percentual com a propriedade real do vídeo. O valor visual não duplica anúncios do leitor de tela. A trilha usa estilos separados para os mecanismos WebKit/Blink e Firefox; Firefox físico não foi testado.

Miniatura usa `aria-disabled` enquanto aguarda mídia, conservando foco e uma explicação alcançável por toque. Seu handler não tenta abrir PiP nesse estado. Com mídia disponível, usa a API real e acompanha entrada/saída. Em erro, o vídeo permanece no player e a mensagem explica a falha. Navegadores sem a API ocultam a ação.

### Primeiro quadro e reconexão

`waitForPlayerFrame()` registra **um** `requestVideoFrameCallback` por fonte e pode cancelá-lo. Em navegadores sem essa API, espera `loadeddata`/`playing` com dimensões de vídeo e estado suficientes. Um callback cancelado não pode revelar uma fonte posterior. Não há contador nem delay que suponha que a transmissão chegou.

`playerstreamchange` sinaliza a nova fonte; `playerstatechange` preserva o caminho de conexão existente. A mensagem de preparação fica sobre o palco até haver imagem. Ao receber o primeiro quadro, muda a opacidade e retira a mensagem da árvore acessível. Na queda de conexão, a raiz continua ativa e o aviso de reconexão entra no mesmo palco. Entrar ou sair de tela cheia não reinicia a revelação da imagem.

A qualidade fixa “1080p 60fps” foi retirada do status do espectador, pois não era uma medição do stream recebido. O status agora informa “Ao vivo”.

## 4. Validação desta revisão

- `npm test`: 10 testes passaram, incluindo solicitação síncrona de tela cheia, seleção de APIs, rejeição, primeiro quadro, cancelamento de fonte antiga e fallback por eventos.
- `npm run build`: Sass e Worker passaram em dry-run, sem publicação.
- 12 viewports: 320×568, 360×640, 390×844, 412×915, 568×320, 667×375, 740×360, 844×390, 932×430, 768×1024, 1024×768 e 1440×900. Os controles de áudio, volume e tela cheia mediram 48 px de altura; não houve overflow horizontal. O botão de tela cheia ficou inteiro na área visível.
- Em 390×844, a largura do botão se manteve em 136 px antes/depois de entrar em tela cheia; ícone e rótulo acompanharam o estado nativo. A saída pelo botão retornou à página.
- Volume por teclado: Home e três passos para a direita resultaram em 15%, com valor do input, texto e preenchimento sincronizados.
- Um toque na Miniatura indisponível explicou a necessidade de vídeo real.
- O proxy local de QA gerou um `MediaStream` sintético de canvas, sem captura da tela, áudio ou download de mídia. O vídeo chegou a `readyState=4`, largura 960 e primeiro quadro confirmado. A troca por uma segunda fonte após interrupção conservou a tela cheia e voltou a revelar a imagem. Este teste não valida o transporte WebRTC.
- A tentativa real de PiP com essa mídia foi recusada no navegador integrado. O estado permaneceu fechado e a mensagem de recuperação foi apresentada. Abertura bem-sucedida de PiP ainda não foi validada.

O cenário sintético fica exclusivamente em `scripts/player-smoke-server.mjs`, fora de `public/` e do deploy. Ele emite quadros explícitos, sem ticker JS persistente. Para usar, inicie `npm run dev` e depois `node scripts/player-smoke-server.mjs`; abra a porta 8788 informada e use Mídia de teste / Simular queda / Restabelecer.

Ainda pendentes: Android/Brave físico, Safari/iOS físico, Firefox, rotação física em tela cheia, áudio real, transporte/reconexão WebRTC entre aparelhos e medição de performance. A preferência de movimento reduzido foi preservada no CSS; o ajuste do sistema não foi alterado para simular essa preferência nesta revisão.

## Segunda passagem: áudio e volume como um conjunto

Pedido: tornar o movimento do áudio mais elaborado e melhorar a interação da barra. Esta passagem substitui o simples crossfade e o marcador circular da revisão anterior.

### Viabilidade

CPU: o range nativo continua selecionando o valor; seus eventos atualizam poucas propriedades locais. GPU/pintura: transformações do marcador e do preenchimento, opacidade e contornos de um SVG 24×24. A animação de traço pode repintar esse SVG pequeno. Memória: três spans decorativos adicionais, sem imagens, textura, canvas ou contexto WebGL. Não há draw calls WebGL, biblioteca nova ou loop JavaScript de animação. O custo é esperado baixo, sem medição de 60 fps em hardware médio.

O input mantém altura de 48 px. A inclinação afeta apenas o marcador decorativo; seleção, hit target e posição real do volume permanecem estáveis. A preferência de movimento reduzido desativa as transições e a inclinação. Compatibilidade física com Brave/Android e Safari segue pendente.

### Referências e adaptação

| Parte | Awwwards | Base técnica | Nossa adaptação |
| --- | --- | --- | --- |
| Ícone de som | [Goodgrowth](https://www.awwwards.com/sites/goodgrowth), com [estudo do autor no Codrops](https://tympanus.net/codrops/2026/08/27/goodgrowth-boot-sequences-spinning-discs-and-the-art-of-the-portfolio/) | [SVG por partes](https://tympanus.net/codrops/2013/11/05/animated-svg-icons-with-snap-svg/) | Duas ondas independentes, desenho progressivo e resposta do corpo do alto-falante. As formas representam ganho configurado, sem fingir medir amplitude sonora. |
| Barra e resposta ao arraste | [Moxey: player próprio](https://www.awwwards.com/inspiration/video-player-moxey), com [estudo no Codrops](https://tympanus.net/codrops/2024/11/15/developing-moxey-a-behind-the-scenes-look-at-the-process/) | [Elastic SVG Elements — Codrops, 2014](https://tympanus.net/codrops/2014/12/15/elastic-svg-elements/), [W3C: interação de slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) | Retorno elástico contido, aplicado por CSS ao marcador vertical. Range nativo, percentual junto da posição e trilha neutra preservam o desenho atual. |

O artigo de elasticidade defende feedback contido, mas seu demo usa morphing de SVG e Snap.svg. Nossa barra usa transformações CSS e easing; não copia o demo nem sua biblioteca. A referência é de 2014, não uma novidade atribuída a 2026. Os exemplos Awwwards orientam coerência visual, sem implicar que tenham este mesmo volume ou estes tempos.

### Arquitetura

`_audio.scss` concentra o componente; os estilos anteriores foram retirados de `_player.scss`. Tokens: 320 ms para acomodação do áudio e 45 ms entre os contornos, além dos 120 ms existentes de resposta imediata.

O nível mudo recolhe os contornos e desenha o sinal de silêncio. Volume positivo até 45% apresenta uma onda; acima disso, duas. Corpo e contornos se acomodam em tempos diferentes. Não há pulsação permanente. O preenchimento e o percentual refletem `video.volume`, e `aria-valuetext` comunica a porcentagem e a condição de silêncio.

A trilha, seu preenchimento e o marcador são decorativos, com `aria-hidden` e sem receber ponteiro. O input original fica sobre eles. A posição visual compensa a metade do thumb nativo para alinhar os valores 0 e 100%. O percentual acompanha a posição, com limite lateral para continuar legível nas extremidades.

Durante o arraste, o delta de volume inclina o marcador até 12 graus; ao soltar, ele retorna usando um easing com pequeno overshoot. `pointerup`, cancelamento, perda de captura, blur do input e blur da janela limpam o estado. Não há captura customizada ou `preventDefault` interferindo na seleção nativa. O gesto por teclado mantém seu comportamento padrão e o foco visível.

Na revisão anterior, em retrato abaixo de 28 rem, o áudio ocupava uma linha própria e o range crescia até aproximadamente 300 px em 390×844. Esse comportamento foi substituído na revisão de proporção de 04/11/2026 descrita ao final deste documento. As medições abaixo registram a versão anterior.

### Validação desta passagem

- Arraste por ponteiro no desktop: 100% → 30%; valor nativo, percentual e estado de uma onda sincronizados. Ao terminar, o estado de arraste e a inclinação foram limpos; a transformação intermediária confirmou a acomodação visual.
- Silenciar em 30%, zerar pelo teclado e reativar restaurou 30%. O texto acessível distinguiu “30%, som silenciado” de “30%”.
- Arraste na barra de 390×844: 100% → 50%, com marcador e percentual alinhados. Tela cheia manteve o range com 48 px e o botão de saída dentro do viewport.
- Nove viewports conferidos: 320×568, 390×844, 412×915, 447×800, 448×800, 390×320, 568×320, 844×390 e 1440×900. Sem overflow horizontal; botão de tela cheia inteiro na área visível. A transição em 447/448 px foi conferida.
- Os 10 testes existentes passaram; não foram criados testes que apenas repetissem a fórmula visual. Console da prévia sem avisos ou erros. Sass compilado e empacotamento do Worker em dry-run.

Esses testes verificam interação e propriedades do elemento de mídia na prévia. Não comprovam audição de uma transmissão real, desempenho físico ou funcionamento com tecnologia assistiva por toque.

### Ajuste de precisão e leitura do percentual

O range passou a `step="0.01"` (1%). O percentual conserva a cor neutra do texto também durante o arraste. A leitura visual acomoda mudanças em 90 ms, definidos por `--duration-volume-number`; volume, posição do marcador e texto acessível continuam imediatos. Existe no máximo um callback de animação pendente: ele muda de destino durante o gesto e para ao concluir, sem criar filas de contadores. Movimento reduzido exibe o valor diretamente.

Conferidos no navegador: 1% e 2% pelo teclado e 37% pelo arraste, com valor final e leitura acessível coincidentes. A alteração não muda o desenho nem as dimensões dos controles.

## Revisão de proporção do volume — 04/11/2026

Registro da primeira passagem. A distribuição de largura fixa desta seção foi substituída pelo volume expansível descrito ao final.

### 1. Performance e viabilidade

O ajuste altera CSS e acrescenta um SVG inline de miniatura. Não acrescenta dependência, requisição, filtro, textura, draw call WebGL ou trabalho JavaScript contínuo. Mantém o mesmo range nativo e os eventos existentes de volume, mute, PiP e tela cheia. Não foi medido FPS ou consumo no aparelho. Safari/iPhone pode restringir o volume programático; esta revisão de layout não resolve nem demonstra essa compatibilidade.

### 2. Referências e contexto

- [Media Chrome — volume range](https://www.media-chrome.org/docs/en/components/media-volume-range): exemplo oficial com mute e volume adjacentes; também documenta indisponibilidade de ajuste em alguns dispositivos.
- [Media Chrome — responsive controls](https://www.media-chrome.org/docs/en/responsive-controls): adaptar os controles à área disponível do player. Aproveitamos o princípio de compactação; não incorporamos o componente ou uma biblioteca.
- [Codrops — Responsive & Touch-Friendly Audio Player](https://tympanus.net/codrops/2012/12/04/responsive-touch-friendly-audio-player/): referência histórica de agrupamento do áudio e dimensões distintas para controles pequenos e trilha flexível. É de 2012; não usamos seu jQuery, plugin ou conclusões antigas de compatibilidade como padrão atual.
- [W3C — Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/): preservar controle de intervalo, nome acessível e operação por teclado. O percentual e o estado mudo continuam sincronizados pelo código existente.

Não há atribuição de prêmio ou de uma solução específica de volume ao Awwwards. A busca complementar no Mobbin foi recusada por exigir plano pago; nenhuma tela não observada foi usada como evidência.

### 3. Causa e arquitetura

Havia três regras concorrentes: duas em áudio/player abaixo de 24/28 rem e uma em nickname até 36 rem. Elas esticavam o range para toda a largura, criavam outra linha e faziam a prévia divergir da transmissão real.

`_player.scss` agora governa a distribuição. O conjunto de áudio tem base discreta sem borda, botão de 48 px e trilha de até 7 rem (112 px com fonte raiz de 16 px). A trilha pode ceder até 4 rem quando há três ações no telefone. No desktop, a unidade inteira mede até 10,75 rem; no compacto, até 10,5 rem. Esses tamanhos são decisões do projeto, não valores prescritos pelas referências.

Abaixo de 40 rem, miniatura e tela cheia usam ícones com nomes acessíveis existentes e alvos de 48×48 px; o lápis opcional conserva o mesmo tamanho. Abaixo de 20 rem, a grade permite outra linha sem comprimir os alvos. Nenhuma largura muda durante hover, foco ou arraste. `_audio.scss` mantém apenas a aparência/interação do range; `_nickname.scss` não governa mais a geometria da barra.

### 4. Validação e limite

A compilação e os testes existentes verificam integração e contratos funcionais, não demonstram a distribuição CSS no aparelho. A inspeção do código conferiu os limites de tamanho e a manutenção de `input[type=range]`, `aria-valuetext`, nomes dos botões e alvos de 48 px. Não houve nova tela ou opção de teste no índice local.

O acesso ao navegador local está desativado nas configurações do Work. A revisão visual renderizada desta alteração e o gesto em Android/iOS físico permanecem pendentes; as capturas e medições de seções anteriores pertencem às revisões anteriores.

## Volume expansível — 04/11/2026

### 1. Performance e viabilidade

O mesmo input nativo atende às duas disposições. O controle usa eventos de ponteiro/foco e uma media query observável; não acrescenta biblioteca, polling, draw calls, textura ou animação contínua. A revelação anima opacidade; a caixa horizontal recebe sua largura final imediatamente para não redimensionar o hit target sob o arraste. O painel vertical fica dentro da raiz de tela cheia, sobre a imagem, sem acrescentar altura à barra. O custo visual é limitado ao painel e seus ícones; não há medição nova de FPS ou prova de compatibilidade física.

### 2. Referências

- O usuário pediu a interação de revelação horizontal associada ao YouTube. O [tema YT do Player.style](https://player.style/themes/yt) é uma referência pública de contexto, não uma auditoria do código atual do YouTube. A implementação local conserva os próprios estilos e controles.
- [MDN — Creating vertical form controls](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Writing_modes/Vertical_controls): o input usa `writing-mode: vertical-lr` e `direction: rtl`, com máximo no topo. Não se roda um hit target horizontal com `transform`.
- [MDN — inert](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert): o range fechado e o mute dentro do painel mobile ficam fora da interação e do percurso de foco. O gatilho comunica `aria-expanded`/`aria-controls`; a orientação do slider acompanha a disposição.

### 3. Arquitetura e interação

`attachVolumeDisclosure` em `public/player-controls.mjs` governa apenas abertura/foco. O código existente continua ligando volume e mute ao vídeo real. No desktop, hover ou foco no áudio abre o range horizontal; clicar no speaker continua alternando mute. O arraste conserva a abertura até liberar/cancelar. Teclado também pode chegar ao range pela sequência Tab ou pelas setas no botão de mute.

Abaixo de 40 rem, ou em apontador primário sem hover/grosso, o ícone é um gatilho explícito. Ele abre uma trilha vertical e um botão de mute separado dentro do painel. Abrir não altera o som. O slider tem largura de toque de 48 px e comprimento entre 4 e 9 rem, limitado pela altura do viewport para paisagem baixa. O percentual fica acima da trilha; o ícone fechado acompanha o volume e o silêncio reais.

Tocar fora, sair com o foco ou perder a janela fecha o painel. Escape é interceptado quando o painel está aberto para fechar primeiro esse controle e devolver o foco ao ícone; isso não promete impedir saídas de tela cheia impostas pelo navegador. Mudanças de media query também atualizam foco/orientação. Ocultar o chrome de tela cheia fecha o volume. Não há novos links, estados de prévia ou controles duplicados de ganho: o botão adicional é apenas o gatilho mobile.

### 4. Validação

Cinco testes de eventos verificam abertura sem mute acidental, Escape/foco, fechamento externo, arraste e cancelamento fora da área, uso por teclado, mudança de modo e fechamento ao perder a janela/ocultar o chrome. Eles não emulam a geometria nativa do slider. A compilação Sass/Worker e os 65 testes da suíte completa passaram nesta atualização.

O navegador local continua desativado no Work. Revisão visual renderizada, gesto real em celular e limites de volume no Safari/iPhone permanecem pendentes. A prévia conectada continua simulada e sem áudio real.

## Superfície líquida em WebGL 2 — 04/11/2026

Implementação experimental autorizada após a análise de viabilidade. Substitui a pele visual do volume na mesma tela, sem acrescentar uma entrada ao índice de prévias.

### 1. Performance e viabilidade

`public/liquid-volume.mjs` usa um contexto WebGL 2 criado somente na primeira abertura, um triângulo e uma chamada de desenho por quadro necessário. Fundo, trilha, preenchimento, marcador e reflexo são calculados no fragment shader; não há textura, upload do vídeo, pós-processamento, blur ou simulação de fluidos em framebuffer. O material é uma iluminação analítica, não refração real do vídeo.

O DPR é limitado a 2. No desktop com fonte raiz de 16 px, o canvas mede 196×72 CSS px, com buffer máximo de 392×144: 56.448 pixels e cerca de 0,22 MiB por superfície RGBA8, antes de buffers do compositor e custo do contexto. Esse cálculo não é medição de memória total. Em vertical a altura acompanha o painel existente.

As molas usam tempo decorrido e encerram o RAF ao atingir repouso. Fechamento chega a zero; aba oculta, elemento fora de vista e movimento reduzido interrompem a animação. Geometria é medida na abertura/resize, não em cada frame da mola. Não há afirmação de 60 fps em hardware médio: o shader foi renderizado em uma RTX 4070 Laptop, sem transmissão real concorrente.

### 2. Referências e adaptação

- [Codrops — Elastic SVG Elements](https://tympanus.net/codrops/2014/12/15/elastic-svg-elements/): deformação de forma e acomodação ligadas à interação. Aproveita-se o raciocínio; não se incorporam Snap.svg ou seus exemplos.
- [The Book of Shaders — Shapes](https://thebookofshaders.com/07/): campos de distância, bordas suavizadas e composição de formas. O shader local une cápsula, elipse e cauda por uma união suave polinomial.
- [MDN — WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): buffer pequeno, alocação conservadora, limpeza e perda de contexto. A implementação usa alpha e dispensa buffers de profundidade/stencil.
- [Moxey — estudo do autor no Codrops](https://tympanus.net/codrops/2024/11/15/developing-moxey-a-behind-the-scenes-look-at-the-process/): referência de integração do player à direção visual e resposta dos controles ao ponteiro. Não é evidência de que Moxey use este shader ou este volume.

### 3. Contratos de arquitetura

O canvas é decorativo (`aria-hidden`, sem ponteiro) e está dentro da raiz de tela cheia. O input nativo, seus limites, teclado, orientação vertical, foco e captura de arraste continuam responsáveis pela interação. `video.volume` e `video.muted` continuam nos handlers originais; o renderer não altera mídia ou valor do input.

A posição central é imediata. O delta de volume impulsiona apenas a deformação do marcador; a pressão engrossa o corpo e a cauda acomoda com amortecimento. O reflexo usa o gradiente local do campo de distância. A superfície de hover se alonga visualmente enquanto a área do input já está na largura final.

A pele CSS continua funcional sem WebGL, durante perda de contexto ou com movimento reduzido. O canvas só substitui trilha/marcador/fundo depois do primeiro desenho válido. Restauração de contexto recria recursos. Descarte remove listeners, observers e programa; página em bfcache pausa e pode retomar.

### 4. Verificação

- Testes novos verificam criação tardia, um contexto reutilizado, resolução limitada, encerramento do RAF, valor imediato, ausência de medidas por frame de mola, fallback, orientação, visibilidade, restauração e descarte.
- O harness local `.wrangler/render-liquid-volume.py` compilou o GLSL real em OpenGL 3.3 desktop e gerou `.wrangler/liquid-volume-gpu.png`, com posições e deformações horizontais/verticais. Somente a declaração de versão/precisão foi adaptada para esse teste. Isso verifica a imagem e as equações, não a compatibilidade WebGL do navegador.
- `npm run build`, os 70 testes da suíte e `git diff --check` passaram. O inventário de ferramentas confirmou novamente que o acesso ao navegador local está desativado no Work.
- Revisão do layout DOM, arraste físico, Safari/iPhone e desempenho junto de WebRTC continuam separados desse resultado. O shader não elimina restrições do sistema sobre volume programático.
