# Tela do transmissor

Revisão de 03/11/2026. Referência: a tela de espera do próprio projeto, enviada pelo usuário. Não se adicionou pesquisa visual externa ou um novo sistema de componentes.

## 1. Performance e viabilidade

Esta página descreve a primeira revisão da tela. A substituição posterior do símbolo por um diorama compacto, suas dependências e seu ciclo de vida estão em [host-diorama.md](host-diorama.md). A fonte local, os tokens, a lista e o convite desta revisão continuam em uso.

## 2. Referência e contexto

A referência enviada define o fundo preto, a tipografia ampla, o texto de apoio em cinza e o símbolo de esferas. O transmissor aplica essa mesma composição à tarefa de selecionar uma tela e acompanhar os espectadores. O botão principal usa os tokens de texto/fundo existentes; Encerrar conserva a cor destrutiva.

As funcionalidades se apoiam nas APIs documentadas: [PeerJS DataConnection](https://peerjs.com/client/api/data-connection), [MediaConnection](https://peerjs.com/client/api/media-connection), [RTCPeerConnection.connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState) e [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText). Não há autenticação Discord no link do espectador: por isso a interface usa Espectador 01, 02 etc., nunca nomes ou fotos inventados. Os números identificam conexões da sessão e não pessoas autenticadas.

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
