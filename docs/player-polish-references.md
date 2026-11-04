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

`_player.scss` conserva a barra fora da área de corte do vídeo. O botão de tela cheia mede 8,5 rem na disposição horizontal; no layout estreito ele usa a coluna flexível existente. Os rótulos se sobrepõem em um grid, sem alterar a largura ao mudar para Voltar. O hit target não se move no hover ou na pressão.

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

Em retrato abaixo de 28 rem de largura, o áudio passa a ocupar uma linha própria. Esse espaço já está reservado antes da interação. Em 390×844, a barra passou de aproximadamente 48 px na revisão anterior para 300 px, sem reposicionar controles ao arrastar. Em paisagem, continua compartilhando a linha quando há espaço.

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
