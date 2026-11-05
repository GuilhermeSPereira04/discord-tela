# Tela do transmissor

Revisão de 03/11/2026. Referência: a tela de espera do próprio projeto, enviada pelo usuário. Não se adicionou pesquisa visual externa ou um novo sistema de componentes.

## 1. Performance e viabilidade

Esta página descreve a primeira revisão da tela. A substituição posterior do símbolo por um diorama compacto, suas dependências e seu ciclo de vida estão em [host-diorama.md](host-diorama.md). A fonte local, os tokens, a lista e o convite desta revisão continuam em uso.

## 2. Referência e contexto

A referência enviada define o fundo preto, a tipografia ampla, o texto de apoio em cinza e o símbolo de esferas. O transmissor aplica essa mesma composição à tarefa de selecionar uma tela e acompanhar os espectadores. O botão principal usa os tokens de texto/fundo existentes; Encerrar conserva a cor destrutiva.

As funcionalidades se apoiam nas APIs documentadas: [PeerJS DataConnection](https://peerjs.com/client/api/data-connection), [MediaConnection](https://peerjs.com/client/api/media-connection), [RTCPeerConnection.connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState) e [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText). Não há autenticação Discord no link do espectador. A pessoa pode informar um apelido opcional; sem ele, a interface usa Espectador 01, 02 etc. Apelidos são autodeclarados e os números identificam conexões da sessão, não pessoas autenticadas.

### Apelido opcional — 04/11/2026

Na primeira entrada, uma tela própria ocupa toda a página e permite informar até 24 caracteres ou continuar sem apelido, inclusive com Escape. A escolha fica em `sessionStorage`, por sala e aba, e não entra na URL nem nos links de convite. Se o armazenamento estiver bloqueado, a entrada continua funcionando. Em esperas e no player existe uma ação para alterar o apelido; salvar em branco restaura a identificação anônima. Cancelar uma edição preserva o nome anterior.

O espectador envia `{ type: 'VIEWER_PROFILE', nickname }` pelo canal de dados antes de `REQUEST_STREAM`, e reenvia o perfil a cada reconexão. O pedido de mídia antigo continua intacto para compatibilidade. O host ignora perfis de canais substituídos, normaliza e limita o texto recebido e o escreve por `textContent`. Alterar um apelido não cria outra chamada de vídeo. O índice duplicado desaparece nas linhas com apelido; espectadores anônimos conservam a identificação anterior.

A entrada inicial usa um `main` próprio, com altura mínima de `100dvh`, padding que considera a área segura e rolagem disponível em telas baixas/teclado virtual. O `main` da espera/player começa com `hidden`; a navegação de QA fica oculta durante a entrada. PeerJS é baixado apenas depois de confirmar ou pular o apelido, e os módulos dos controles do player aguardam o evento `viewerjoined`. Se o download de conexão falhar, aparece uma ação de tentar novamente. Com um apelido lembrado, a entrada é pulada normalmente. A prévia local `preview=nickname` sempre apresenta o formulário, para ajustes visuais, sem alterar o comportamento dos links remotos.

A edição posterior reutiliza o mesmo formulário em um [`dialog`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) nativo, com rótulo, descrição, foco e cancelamento. Quando aberto pelo player, o diálogo é movido para dentro da raiz do player para acompanhar a tela cheia. Essa edição preserva a mídia em andamento. O controle de edição mantém área de toque de 48 px; celulares usam duas linhas para manter áudio e ações acessíveis. Não há animação contínua ou biblioteca adicional na tela inicial de apelido.

Os [olhos neon aprovados](audience-eyes-study.md) agora decoram a lista na transmissão real, com ou sem apelido. A montagem fica no módulo do host de `worker.js`; a lista continua derivada somente das conexões reais. O preview local foi consolidado em `scripts/preview.mjs` e oferece uma única tela de transmissão, com dados sintéticos exclusivamente nesse servidor.

Testes executam o script do HTML realmente gerado e cobrem entrada com/sem nome, Escape, armazenamento bloqueado, carregamento adiado de PeerJS e recuperação de falha, apelido lembrado, prévia local repetível, edição e cancelamento, reconexão, clientes antigos, dados inválidos, caracteres de controle, limite Unicode e conteúdo HTML como texto. A revisão da tela dedicada no Chromium, em desktop e viewport de 390 px, verificou `main` da transmissão oculto, zero scripts externos, zero canvases e zero botões decorados antes de continuar. Depois de confirmar, PeerJS e os controles passaram a carregar. Não houve overflow horizontal no viewport de 390 px. Esses dados confirmam a separação das etapas; não medem redução de CPU/GPU, FPS, teclado de telefone físico ou transmissão entre aparelhos. Os registros visuais abaixo são de revisões anteriores.

## 3. Arquitetura

- `worker.js`: abertura com Compartilhe sua tela; estado Preparando a sala até o Peer abrir; lista vinculada às chamadas reais; convite para o modo view, removendo preview; áudio indicado pela existência de trilhas na captura. A indicação não mede a intensidade do áudio nem garante áudio recebido em outra rede.
- `_host.scss`: composição inicial com o mesmo símbolo e escala de título da espera. Lista abaixo da abertura, ao lado do vídeo em desktop e abaixo dele em telas estreitas. Rolagem permanece disponível em telas baixas. A interface de espectador conserva sua composição.
- Solicitações repetidas não criam outra chamada para o mesmo peer. Eventos de chamadas/conexões antigas só removem sua própria referência. A saída do canal de dados fecha a mídia correspondente; Encerrar limpa a lista. Uma seleção de tela que termina depois de Encerrar é descartada.
- Copiar link oferece retorno textual; se Clipboard for recusado, exibe um campo selecionável. Cancelamento/falha de captura também recebe retorno na interface.

## 4. Verificação

Build Sass/Worker em dry-run e testes Node, incluindo presença inicial vazia, requisições duplicadas, mudança de estado de transporte, fechamento de mídia, eventos antigos, convite e reinício da sessão.

Teste no navegador com captura sintética e sinalização PeerJS: duas abas apareceram como Espectador 01/02, ambas Conectado. Ao navegar uma delas para fora, o total passou de 2 para 1 e permaneceu Espectador 02. A cópia de convite apresentou confirmação. Console do transmissor sem avisos/erros.

Os layouts compacto e desktop foram observados com larguras úteis de aproximadamente 376 e 1265 CSS px; os controles principais mediram pelo menos 44 px de altura e não houve overflow horizontal nessas observações. A ferramenta não aplicou consistentemente os demais tamanhos solicitados, que não são contabilizados como validados. Captura física de tela, Safari/iOS e Android físicos permanecem fora desta revisão.

Os scripts sintéticos continuam fora de `public` e da publicação. Nenhum nome de exemplo ou espectador simulado foi acrescentado ao front de produção.
