# Tela cheia: preenchimento fluido e clique breve

Revisão de 03/11/2026. Referência direta: gravação enviada pelo usuário, de 7,67 s, 214×70 e 30 fps. O arquivo original foi apenas lido. Pranchas de análise ficam na pasta de visualizações local, sem integrar os assets públicos.

## 1. Performance e viabilidade

O efeito ocupa apenas o botão. Uma superfície clara é revelada com `clip-path: inset(...)`; seu conteúdo escuro é uma cópia decorativa do conteúdo original. O recorte pode exigir pintura/composição dependendo do navegador, por isso não se afirma execução exclusiva na GPU nem 60 fps universais. A área de trabalho é pequena: botão com altura de 48 px e largura responsiva.

O clique reutiliza cinco spans de 2 px e anima somente opacidade/transform por 350 ms usando Web Animations. CPU: eventos de interação e agendamento das animações, sem loop JS por quadro. Memória: uma cópia do SVG/rótulo e cinco partículas fixas. Não há canvas, textura, WebGL, draw calls WebGL ou biblioteca nova. Cliques seguintes cancelam as partículas anteriores, conservando o limite de cinco. Ao terminar, a animação é cancelada e a opacidade de repouso volta a zero.

Movimento reduzido remove as transições e desativa as partículas, incluindo o cancelamento de um efeito já iniciado. Hover depende de apontador fino; toque mantém clique e entrada/saída de tela cheia. O preenchimento também responde ao foco de teclado. APIs e CSS precisam continuar sendo conferidos em Android/Brave e Safari físicos.

## 2. Referências e contexto

Na gravação, o painel claro cresce da esquerda e se retira para a direita. Texto claro passa a escuro na região coberta pelo painel. Não foi identificada a origem do código, biblioteca ou autoria do efeito; a implementação é uma reprodução visual própria.

- [Codrops — Ideas for CSS Button Hover Animations](https://tympanus.net/codrops/2021/02/17/ideas-for-css-button-hover-animations/): superfícies e conteúdo separados, com recorte e transformação. O artigo também alerta para preservar o contorno de foco ao recortar um botão.
- [Codrops — Subtle Click Feedback Effects](https://tympanus.net/codrops/2015/02/11/subtle-click-feedback-effects/): feedback localizado e breve para confirmar o clique/toque. A distribuição em cinco pontos é nossa; não foi copiada uma animação completa do artigo.
- [MDN — clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path), [Web Animations](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) e [requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen): mecanismos usados e necessidade de manter a solicitação nativa vinculada à ativação do usuário.
- [Moxey — player no Awwwards](https://www.awwwards.com/inspiration/video-player-moxey) e seu [estudo no Codrops](https://tympanus.net/codrops/2024/11/15/developing-moxey-a-behind-the-scenes-look-at-the-process/): contexto visual já escolhido para este player. A organização dos controles e a paleta neutra orientam a adaptação. Não se atribui este hover ou as partículas à implementação do Moxey.

Os artigos de 2021/2015 são fundamentos consultados, não novidades de 2026. O vídeo do usuário é a referência principal do movimento. Preto e branco, Instrument Sans, raio existente e geometria do ícone atual foram preservados.

## 3. Arquitetura

O [padrão compartilhado](button-motion.md), em `abstracts/_button-motion.scss`, recorta somente `.button-motion-surface`. O botão mantém suas dimensões, contorno de foco e overflow para as partículas. O conteúdo original continua sendo o único controle acessível. O clone é colocado em uma superfície `aria-hidden`; seus IDs são retirados para não duplicar identificadores. As duas cópias recebem o mesmo estado do ícone e do rótulo Tela cheia/Voltar/Ampliar. O antigo componente específico `_fullscreen-button.scss` foi substituído por esse mixin e pela classe `.motion-button`.

Estados do painel:

1. `idle`: recorte completo pela direita, preparado para entrar da esquerda.
2. `hover`: painel completo, com conteúdo escuro no mesmo alinhamento do conteúdo claro.
3. `out`: recorte avança pela esquerda, retirando o painel pela direita.

Ao terminar a saída, o painel invisível é reposicionado sem transição. Ao reentrar antes do fim, o navegador interpola o recorte atual para o novo destino. Não há inversão abrupta de `transform-origin`. Duração de 440 ms/easing reutilizados do sistema de rótulos; a parte principal do movimento responde rapidamente, com acomodação no final.

A primeira tentativa usou `mix-blend-mode: difference`. A captura após interação perdeu conteúdo do restante da página, sem causa universal determinada. Foi substituída por duas camadas recortadas, cujo contraste pôde ser conferido em estado normal/foco. A captura do navegador integrado também apresentou inconsistências depois de transições nativas de tela cheia; o estado funcional foi verificado por eventos/DOM e árvore acessível, sem tratar esse artefato como prova de comportamento em aparelhos físicos.

`fullscreen-feedback.mjs` mantém os adaptadores do player; a apresentação compartilhada está em `button-motion.mjs`. O listener funcional de clique é registrado antes do listener de partículas: a chamada nativa começa sincronamente, e nenhuma animação é aguardada para abrir ou fechar tela cheia. As partículas pertencem ao botão dentro da mesma raiz do player, preservando sua apresentação quando essa raiz entra em tela cheia. Elas sobem de 15 a 23 px, sem receber ponteiro ou alterar layout. O efeito indica clique, não sucesso da solicitação.

## 4. Validação

- Inspeção da gravação completa e amostragem a 30 fps da entrada para confirmar direção do painel.
- Preenchimento e inversão visual de texto/ícone conferidos. Foco de teclado alcançável, com um único ID `fullscreen-label` e um único controle acessível.
- Saída e reentrada antes do término verificadas pelo teclado: o recorte passou de entrada parcial a saída parcial e retornou ao painel completo, sem reset intermediário.
- Clique abriu tela cheia nativa e outro clique retornou à página. A raiz manteve o estado correto e o alvo conservou 48 px de altura.
- Cinco partículas observadas com opacidade intermediária durante os cliques e zero em repouso, sem aumento do número de elementos.
- 320×568, 390×844, 844×390 e 1440×900: sem overflow horizontal, botão inteiro no viewport e altura de 48 px. Nenhum tamanho depende do hover para acessar a ação.
- Console da prévia sem erros/avisos. Os 10 testes existentes de fullscreen/primeiro quadro passaram, assim como Sass e o empacotamento em dry-run. Não houve publicação.

Ainda pendentes: aparelhos físicos, preferência de movimento reduzido acionada em runtime, desempenho medido e observação de partículas em tela cheia nativa do iOS. Não foram adicionados testes de unidade que apenas repetissem posições e tempos do efeito visual.

## Miniatura: variação secundária

O pedido seguinte aplica o mesmo movimento apenas à borda do Miniatura. `_pip-button.scss` mantém fundo transparente e texto na cor secundária; um contorno de 1 px é revelado da esquerda e retirado pela direita. A decoração é absoluta e não modifica o tamanho do botão. O estado PiP ativo fortalece o contorno, em vez de preencher a superfície. Partículas ficam restritas à Tela cheia.

Os dois botões compartilham `attachDirectionalReveal()` em `fullscreen-feedback.mjs`, com os mesmos 440 ms, easing e suporte a foco/reentrada. A diferença visual é decidida pelos respectivos componentes Sass. Um contorno pequeno substitui a superfície/clone; não há novos loops, biblioteca ou contexto gráfico. As referências e os limites de performance da análise acima continuam aplicáveis.

O contorno de foco permanece fora do recorte. Na prévia sem vídeo, `aria-disabled` e a descrição de indisponibilidade continuam ativos; em repouso a opacidade é de 75%. No hover/foco, texto e borda passam ao branco do sistema com opacidade de 100%, mantendo o fundo transparente e a hierarquia de ação secundária. Ativar por teclado apresenta a explicação existente, sem abrir PiP fictício. Navegadores sem suporte ao recorte usam mudança simples da cor da borda.

Verificados: foco por teclado e explicação da prévia; entrada/saída de tela cheia após compartilhar o controlador; cinco partículas apenas no botão principal; fundo transparente do Miniatura; alvo de 48 px. Em 320×568, 390×844, 844×390 e 1440×900 os dois botões permaneceram inteiros no viewport, sem overflow horizontal. Console sem avisos/erros, 10 testes existentes e build em dry-run passaram. A abertura bem-sucedida de PiP e aparelhos físicos seguem com os limites anteriormente registrados.

## Selecionar tela: reutilização no transmissor

O CTA inicial do host utiliza o mesmo `attachFullscreenFeedback()` e as mesmas regras Sass da Tela cheia. Mantém preenchimento direcional, texto invertido, foco e cinco partículas, sem biblioteca ou loop adicional. O listener funcional de captura permanece anterior ao feedback visual, sem aguardar a animação para chamar `getDisplayMedia()`.

Na revisão com o diorama ampliado, hover e foco ativaram o painel claro; a árvore acessível conservou um único botão Selecionar tela e o ID do rótulo permaneceu único. Console sem erros, 30 testes existentes e build em dry-run passaram. Não houve publicação.
