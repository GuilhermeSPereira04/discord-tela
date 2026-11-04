# Player responsivo e tela cheia

Revisão de 03/11/2026. Alvo informado: Android com Brave ou outro navegador. Validação atual feita no navegador integrado do desktop; não equivale a um teste físico no Android.

Este documento registra a correção inicial de layout. O refino posterior, os 10 testes atuais e o cenário de mídia sintética estão em [player-polish-references.md](player-polish-references.md).

## 1. Performance e viabilidade

O ajuste usa Grid/Flex, unidades dinâmicas de viewport e os eventos das APIs de mídia. Não adiciona biblioteca, filtro, renderização WebGL, polling de dimensões ou loop JavaScript por quadro. A barra tem espaço próprio, permanentemente acessível, e o vídeo usa `object-fit: contain`, conservando a imagem completa com faixas quando necessário.

O custo principal continua sendo decodificar e apresentar o stream. A mudança de layout não demonstra 60 fps, qualidade de transmissão ou compatibilidade com todas as GPUs. Não há medição de memória/GPU neste trabalho. A animação da espera anterior permanece separada e para no estado conectado.

## 2. Referências e contexto

Esta revisão trata a interação do player; não introduz uma técnica visual nova atribuída ao Awwwards. Mantém a direção já pesquisada em [design-system.md](design-system.md): preto e branco, Instrument Sans, hierarquia tipográfica e ausência de decoração sem função. Os ícones indicam apenas áudio e expansão; não animam continuamente sobre a transmissão.

As decisões de compatibilidade usam APIs documentadas:

- [MDN — requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen): a solicitação depende de ativação transitória pelo usuário e pode ser rejeitada. A chamada acontece diretamente no clique, antes de qualquer `await`.
- [MDN — Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide): o elemento que entra em tela cheia contém seus descendentes; por isso a raiz inclui vídeo, aviso e controles. Eventos reais atualizam o botão após saídas iniciadas pelo navegador.
- [MDN — unidades de comprimento](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length): `dvh` acompanha a área dinâmica do navegador, com `vh` como alternativa para versões antigas.
- [Apple — vídeo no Safari](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari) e [controles JavaScript de mídia](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/ControllingMediaWithJavaScript/ControllingMediaWithJavaScript.html): `playsinline` e tela cheia nativa de vídeo são caminhos distintos da expansão de um elemento HTML. O caminho de vídeo usa os controles do sistema, sem prometer preservar a barra HTML.
- [W3C — Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html): 44×44 CSS px é a referência aprimorada AAA. Aqui os controles do player adotam altura mínima de 48 px; isso não é uma certificação WCAG da página.

## 3. Causa e arquitetura

### Falha reproduzida

Em 844×390 CSS px, as alturas mínimas do conteúdo e do quadro da prévia empurravam o botão de tela cheia para baixo: seu limite inferior chegava a aproximadamente **528 px**, fora da área inicialmente visível. A página media 544 px de altura. A antiga função também descartava silenciosamente a rejeição de `requestFullscreen()`.

### Espaço reservado para os controles

`styles/src/components/_player.scss` concentra o layout. A raiz ativa tem linhas `minmax(0, 1fr) auto auto`: imagem, controles e eventual aviso. Os filhos flex/grid têm mínimos zerados para que o vídeo ceda espaço à barra. O corte por overflow se limita ao palco do vídeo, sem cortar os controles.

O espectador usa `100dvh`; a barra considera as áreas seguras laterais e inferiores, e o cabeçalho considera o recorte superior. Em larguras inferiores a 24 rem, o áudio e as ações ficam em duas linhas. Se PiP não for suportado, seu botão fica oculto e a ação restante ocupa o espaço disponível. Em paisagem baixa, cabeçalho e espaçamento encolhem, sem reduzir a área de toque. Nomes de sala longos usam reticências no cabeçalho conectado, mantendo o texto completo no DOM.

Não há bloqueio de orientação, recarga, remount do vídeo ou chamada para entrar/sair de tela cheia em eventos de resize. A altura mínima de 16 rem permite rolagem em áreas excepcionalmente baixas; não se corta o acesso aos controles para forçar toda a página a caber.

### Estado de tela cheia

`public/player-controls.mjs` separa a solicitação das atualizações de interface:

1. Prefere tela cheia do elemento que contém todo o player.
2. Considera a API prefixada quando disponível.
3. Usa tela cheia nativa de vídeo quando essa for a API disponível e já houver mídia carregada.
4. Sem uma API utilizável, oferece **Ampliar** dentro da página. Se a solicitação for rejeitada, amplia o player e informa o ocorrido. Essa alternativa não remove as barras do navegador.

`fullscreenchange`, eventos prefixados e eventos nativos de vídeo sincronizam o rótulo **Voltar**, o estado acessível e o retorno do foco. Cliques repetidos são bloqueados durante a solicitação. A expansão dentro da página também pode sair por Escape. A saída da tela cheia nativa continua sob controle do navegador.

Áudio reflete `volumechange`; o slider tem nome acessível, e reativar um volume zerado restaura o último volume positivo. PiP depende tanto da capacidade do navegador quanto da presença de um vídeo real. A prévia não inventa mídia para habilitá-lo.

### Interrupção e retomada

`worker.js` separa conexão de apresentação: `viewerConnected` governa novas tentativas, enquanto `showPlayer('waiting')` conserva a raiz ativa. Uma interrupção apresenta a mensagem de espera dentro do mesmo player. Ela não remove o elemento em tela cheia nem o botão de saída, e não limpa o vídeo por motivo meramente visual. Chamadas antigas não podem sobrescrever o estado de uma chamada mais recente.

Isso protege o caminho de tela cheia de elemento. Não há garantia de que o player nativo do iOS permaneça aberto durante uma troca real de `MediaStream`; esse comportamento precisa ser validado no aparelho.

## 4. Validação

Verificações no navegador integrado:

| Cenário | Resultado observado |
| --- | --- |
| 320×568, 360×640, 390×844, 412×915 | Botão de tela cheia inteiro no viewport, altura de 48 px, sem overflow horizontal |
| 568×320, 667×375, 740×360, 844×390, 932×430 | Barra visível em paisagem sem tela cheia |
| 768×1024, 1024×768, 1440×900 | Layout preenchendo o espaço, controles acessíveis |
| 844×390 após a correção | Botão entre aproximadamente y=334 e y=382; documento com 390 px |
| 320×568 com título longo | Cabeçalho contido e botão visível, sem aumentar a largura do documento |
| Entrar/sair pelo botão, em retrato e paisagem | Tela cheia nativa do elemento e retorno do foco ao botão |
| Interrupção/retorno de apresentação em tela cheia | Mensagem de espera e retorno à prévia sem sair da tela cheia; botão Voltar preservado |
| Alternar prévia Conectando/Conectado | Animação anterior preservada e player sem animação de espera |

O console da prévia conectada não apresentou avisos ou erros. `npm test` passou em 6 testes de seleção das APIs, chamada síncrona, rejeição e ausência de mídia. `npm run build` passou em Sass e empacotamento do Worker com `--dry-run`, sem publicação.

O teste de interrupção usa `node scripts/player-smoke-server.mjs`, depois de iniciar `npm run dev`. Abra o link informado na porta 8788. O proxy local acrescenta dois botões para chamar os caminhos reais de apresentação de queda/retorno. O script fica fora de `public/`, não entra no deploy e não simula tráfego WebRTC, perda de pacotes ou retomada real de áudio/vídeo.

### Limites ainda não validados

- Android/Brave físico, Safari/iOS físico, barras dinâmicas e recortes de aparelhos reais.
- Rotação física enquanto a tela cheia está ativa. A ferramenta de emulação pode encerrar tela cheia ao alterar o viewport; esse resultado não prova uma falha ou um sucesso no telefone.
- Saída nativa por Escape/gesto Voltar do sistema: o teste de tecla no navegador integrado não deu confirmação consistente. A saída pelo botão do player foi confirmada.
- Recepção e reconexão de stream real, áudio real, PiP real e desempenho em hardware médio.

Não houve aparelho conectado via ADB para completar a etapa física. A prévia permite revisar o front, mas não substitui esses testes.
