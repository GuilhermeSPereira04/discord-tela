# Controles retráteis e Voltar na tela cheia

Revisão de 03/11/2026.

## 1. Performance e viabilidade

O ajuste usa CSS, cliques, teclado e eventos de histórico/tela cheia. Não acrescenta loop, biblioteca, captura, cópia de vídeo ou processamento de áudio. Ocultar a barra remove sua linha do Grid: a imagem recebe também o espaço antes reservado aos controles. `object-fit: contain` mantém a proporção e a imagem inteira; faixas necessárias pela proporção permanecem.

O comportamento se aplica à tela cheia de elemento e à expansão dentro da página. A tela cheia nativa de vídeo do Safari mantém os controles e a navegação do sistema. A alteração não comprova desempenho de decodificação nem comportamento de um telefone físico.

## 2. Referências e contexto

Este é um ajuste funcional do player, apoiado nas APIs da plataforma:

- [Fullscreen API Standard, UI](https://fullscreen.spec.whatwg.org/#ui): uma solicitação nativa de fechamento deve encerrar a tela cheia antes de outros observadores de fechamento. O navegador também pode encerrá-la por iniciativa própria.
- [HTML Standard, close requests](https://html.spec.whatwg.org/multipage/interaction.html#close-requests): Voltar/gesto no Android pode ser uma solicitação de fechamento; esse caminho não exige um evento de teclado no documento.
- [MDN, pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) e [popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event): uma entrada no mesmo documento permite consumir uma navegação Voltar sem descarregar a sala.

Não se atribui esse comportamento a um site premiado nem se promete interceptar todo gesto de sistema. O navegador controla tela cheia e navegação.

## 3. Arquitetura e interação

`worker.js` inclui um botão transparente sobre o palco da imagem. Ele só fica disponível quando há imagem em tela cheia/expansão. Os nomes acessíveis alternam entre Mostrar e Ocultar controles. O botão de ativar áudio permanece acima dessa área.

`player-controls.mjs` remove a barra com `hidden` e a classe `is-controls-hidden`. Outro clique/toque recupera a barra; Tab recupera os controles antes de o navegador escolher o próximo foco. Avisos novos, espera por imagem, interrupção e saída da tela cheia restauram a barra. Se a interrupção ocultar o botão que estava focado, o foco vai para a saída da tela cheia. O vídeo e sua fonte não são recriados para alternar os controles.

`fullscreen-navigation.mjs` adiciona uma única entrada de histórico com a mesma URL quando a apresentação começa. Um `popstate` de Voltar desarma essa entrada antes de solicitar a saída, evitando reinseri-la durante a sincronização. Sair pelo botão ou por evento nativo consome a entrada temporária, e o próximo Voltar pode navegar normalmente. A ação de tela cheia fica bloqueada enquanto essa limpeza assíncrona termina. Avançar não tenta reabrir tela cheia sem ativação do usuário.

## 4. Validação

- 18 testes passaram, incluindo preservação do estado anterior, ausência de duplo Voltar, navegação normal depois da saída, cinco ciclos sem acumular entradas e History API recusada por webview.
- Build do Worker e Sass aprovados em dry-run, sem publicar.
- Navegador integrado, com mídia sintética real do script de QA: ocultar/mostrar, Tab com foco no botão de som, entrada/saída pelo player, saída direta pela API nativa e Voltar do navegador com a barra oculta.
- Ao ocultar, a barra passou de 72 px para zero e o palco ocupou toda a altura do player. Faixas por diferença de proporção continuam possíveis.
- Voltar preservou a sala; após saída nativa, o próximo Voltar alcançou a página anterior.
- Queda programada com a barra oculta: os controles voltaram, a tela cheia permaneceu aberta e o foco foi para sua saída. Restabelecer recuperou a imagem. Console do cenário sem avisos/erros.
- A emulação de viewport pode ser alterada ou encerrada pelo modo nativo do navegador integrado. Seus resultados não validam orientação física, barras móveis ou o gesto Android.

Para reproduzir: iniciar `npm run dev`, depois `node scripts/player-smoke-server.mjs`, abrir a URL informada e clicar em Mídia de teste. O script de QA também oferece Queda em 1,5 s para ocultar a barra antes da interrupção e Saída nativa para exercitar o evento sem passar pelo botão do player. Esses controles ficam fora dos arquivos publicados.

Pendentes de validação física: botão lateral real do mouse, Android/Brave, gesto Voltar no celular e Safari/iOS. O teste de navegação do navegador cobre o caminho de histórico usado quando esses dispositivos solicitam Voltar; não comprova qual comando cada dispositivo enviará. Escape enviado pela ferramenta não confirmou saída nativa e não foi contado como aprovação.
