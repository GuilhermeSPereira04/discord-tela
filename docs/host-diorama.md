# Diorama compacto na abertura do transmissor

Implementação local de 03/11/2026. A análise da referência original está em [research/ascii-diorama/ANALYSIS.md](../research/ascii-diorama/ANALYSIS.md).

## 1. Performance e viabilidade

A cena executa em worker dedicado, com WebGL 2 via OffscreenCanvas. A [preparação estática passou para o build](diorama-startup.md): alturas, mapa de cores/classes e seleção das posições de vegetação. O worker reconstrói as instâncias aceitas e mantém vento, água, câmera e raposa em tempo real. Nada disso roda na thread que atende o botão de captura. O módulo leve do host transfere um canvas e acompanha visibilidade, captura e preferência de movimento.

O bloco usa `clamp(26rem, 40vw, 38rem)` no desktop: 416–608 px com fonte base de 16 px. Abaixo de 64 rem, o layout empilha e usa `clamp(18rem, 80vw, 28rem)`, limitado à largura disponível e com proporção quadrada. Ao iniciar cada worker, uma área de pelo menos 400 px recebe canvas 768²/grade 128×64; áreas menores usam 512²/96×48. A escolha permanece até o próximo boot para não reconstruir a cena a cada resize. Os draws continuam limitados a aproximadamente 30 por segundo; não é garantia de fps medidos. A cena não altera os estilos globais do body.

A referência original usa grade 200×100. A primeira integração compacta usava 80×40; a ampliação atual recupera mais células para representar as variações pequenas do vento. O terreno conserva forma/composição, usando amostragem de altura 240×250, bake de cor/classe 768×802, malha 192×200 e sombra 1024². Os sistemas de grama, flores, árvores, mar, objetos, raposa, partículas e câmera são mantidos. O algoritmo ASCII por classe, o vento e o tilt-shift seguem o original.

Nas áreas maiores, 768² representa 2,25 vezes os pixels de 512² por alvo; os passes de imagem e seus buffers custam mais. Não foram adicionadas instâncias, passes ou draw calls. Nas menores, o buffer permanece em 512². Essa decisão melhora a definição junto do tamanho, em vez de apenas ampliar os mesmos pixels; exige validação de desempenho em aparelhos físicos.

No navegador deste computador, o primeiro quadro da versão compacta foi observado em 1918 ms, com 27 draw calls e 1.374.302 triângulos reportados, incluindo sombras. Essa observação não é uma medição de GPU da nova versão nem prova de taxa de quadros em celulares. O original havia levado 6774 ms na execução documentada; são execuções diferentes, sem controle de cache ou repetição estatística.

## 2. Referência e compatibilidade

Origem: [JDhruv14/ascii-diorama](https://github.com/JDhruv14/ascii-diorama), commit `3d3278a0f925aebddc574dfb7042eb1eb815f427`, MIT. A versão intacta permanece na pesquisa. O atlas é rasterizado em OffscreenCanvas e as imagens usam createImageBitmap, com orientação aplicada no decode das texturas que substituem TextureLoader.

Referências técnicas: [transferControlToOffscreen](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen), [RAF em worker dedicado](https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame), documentação e código do ImageBitmapLoader do Three.js 0.187.0.

Falta de worker/OffscreenCanvas, erro de contexto/extensão/shader/dados ou movimento reduzido mantém uma imagem estática da mesma versão compacta. A descompressão dos dados usa `DecompressionStream` no worker; ausência desse recurso também entra no fallback. Não se tenta gerar a cena pesada na thread principal como alternativa. Safari/iOS e Android físicos não foram validados.

## 3. Arquitetura e ciclo de vida

- `effects/diorama/`: fonte adaptada do worker, assets originais, poster e créditos; é a fonte versionável da integração.
- `scripts/build-diorama.mjs`: bake dos dados/cor/classes, variantes de textura, nomes com hash e bundle do worker, com avisos de licença em `public/diorama`, diretório gerado e ignorado pelo Git. Os JPEGs originais não são mais copiados para produção.
- `effects/diorama/world.mjs` e `scene-data.mjs`: matemática determinística compartilhada e contrato binário validado. A vegetação mantém as posições, escalas, rotações e cores originais sem repetir as buscas por rejeição em cada abertura.
- `scripts/build-client.mjs`: compila Sass e assets. É chamado pelo build do Wrangler, sem depender da pasta de pesquisa ou de um arquivo gerado previamente.
- `public/host-diorama.mjs`: carregado somente pelo HTML de host; não importa Three.js na página. Cria, pausa, retoma e termina o worker.
- `worker.js`: insere o bloco somente no transmissor e sinaliza `hostcapturechange` antes de chamar getDisplayMedia, sem aguardar import ou preparo da cena. `finally` libera o estado de captura pendente, inclusive após cancelamento.

Ao iniciar a seleção de captura, o worker é terminado e o canvas removido, mesmo se o bake ainda estiver em andamento. A captura ativa mantém esse estado. Ao cancelar ou encerrar, a abertura pode criar um worker novo. Um ready de worker antigo não pode remontar o canvas.

Uma aba oculta ou bloco fora do viewport pausa o RAF de uma cena pronta. Se ela ainda estiver em preparo, o worker é terminado. O retorno retoma a cena pronta ou inicia novamente o preparo; não há renderização de quadro congelado em loop. Pagehide termina o worker e pageshow reavalia a apresentação. O worker é proprietário do contexto, bitmaps e buffers; terminar sua execução encerra o trabalho e deixa a liberação física dos recursos ao navegador.

O box tem tamanho reservado desde o HTML inicial. No fluxo normal, nenhuma foto é solicitada ou exibida: o canvas entra após o sinal `ready`, enviado pelo worker depois do primeiro `drawFrame()`. Durante a preparação, o box conserva o fundo da página e o botão de captura pode ser usado. Isso evita que um poster pareça uma animação travada e mantém o título na mesma posição. Ainda é necessário carregar os assets, reconstruir as instâncias e preparar o primeiro render.

O poster é solicitado somente ao entrar em `fallback` por movimento reduzido, recurso ausente ou erro. Ele foi capturado do diorama compacto renderizado, sem substituir o efeito por arte gerada. Estados `loading`/`idle` escondem a foto mesmo se ela já tiver sido carregada antes, por exemplo ao mudar a preferência de movimento.

## 4. Validação

- Testes de cancelamento, sinalização anterior à captura, encerramento durante bake, eventos antigos, pausa/retomada, movimento reduzido, recurso ausente e erro de worker, além dos testes existentes de host/player/histórico.
- Captura sintética na validação inicial: durante a transmissão, zero canvas no bloco; ao encerrar, novo worker e retorno ao estado running. Não foi capturada a tela real do usuário. Na revisão de inicialização, o estado sem worker passou de `poster` para `idle`, exceto em fallback real.
- Modo view mantém as quatro instâncias decorativas das esferas e nenhum canvas/diorama. HTML de view não inclui o módulo host-diorama nem o poster.
- Validação inicial, antes da ampliação: bloco de 192×192 px no layout compacto e 224×224 px no desktop; sem overflow horizontal na observação compacta de 304 px de largura útil. Console da animação e do cenário sintético sem avisos/erros.
- Após a ampliação: 358,4×358,4 px na prévia de desktop com 1265 px de largura útil, sem overflow horizontal. A conferência desta revisão não incluiu aparelho móvel físico.
- Créditos do código, das texturas e da raposa são servidos em `/diorama/credits.txt`, com `link rel="license"` no HTML do transmissor, sem botão visível. MIT do Three.js é copiada integralmente em `THREE-LICENSE.txt`; o bundle mantém seus avisos.
- Selecionar tela compartilha o [padrão de hover](button-motion.md) do botão de tela cheia: preenchimento direcional, inversão do texto, foco e cinco partículas. O rótulo original conserva um único ID; a camada decorativa não duplica controles acessíveis. Os 30 testes e o build em dry-run passaram na revisão inicial desse hover.
- Build em dry-run, sem publicação. Os assets do diorama entram no pacote estático, mas só o modo host os solicita.

## Revisão da entrada da animação

A foto estática do HTML inicial era a causa confirmada da aparência de congelamento antes da animação. O preparo real ocorre em worker e só envia `ready` após carregar as texturas/modelo, construir o terreno e desenhar a cena com seus passes ASCII e tilt-shift. Download concluído não equivale a primeiro quadro pronto. A [documentação do Three.js](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync) também distingue o preparo dos shaders do render sem esperas de compilação; não foi feita uma atribuição percentual do tempo de boot a cada etapa.

A correção é de apresentação/ciclo de vida, sem alterar a técnica, resolução ou orçamento de render. Os testes cobrem ausência de requisição do poster em carregamento normal, retorno após cancelamento, fallback por erro/recurso ausente e alternância da preferência de movimento. Os 32 testes e build em dry-run passaram.

No navegador local, um proxy privado atrasou em 4 s o download do worker. Desde o HTML inicial até `running`, o poster permaneceu sem `src` e com `visibility: hidden`; a caixa conservou exatamente posição e dimensões de 358,4² px. A animação entrou depois, com movimento observado em capturas sucessivas e console sem erros/avisos. Sem o atraso artificial, uma execução reportou boot de 2013 ms a partir do início do módulo do worker; não é garantia de tempo em outros aparelhos ou conexões. A auditoria temporária ficou em `.wrangler/startup-qa-server.mjs`, fora dos assets publicados.

## Ampliação para leitura do vento

Na segunda ampliação, a prévia com 1265 px de largura útil apresentou caixa de 512² px, canvas 768² e grade 128×64. Uma janela de teste de 390 px apresentou caixa de 312,2² px, canvas 512² e grade 96×48. Ambas chegaram a `running`, sem erros/avisos de console, com 27 draw calls e 1.374.302 triângulos incluindo sombras. Não foi feita medição de tempo de GPU nem de fps sustentados.

Conferência responsiva em iframes: larguras úteis de 320, 753 (frame externo de 768 com scrollbar), 1024 e 1440 px renderizaram caixas quadradas de 288, 448, 416 e 576 px, respectivamente, sem overflow horizontal. Os 32 testes e build em dry-run passaram. O servidor Wrangler não respondeu à inspeção HTTP nesta revisão; a verificação visual usou `.wrangler/detail-preview-server.mjs`, que empacota o HTML/CSS real de `worker.js` e serve os assets gerados, sem simular a animação. Isso verifica o render/layout local, não uma publicação Cloudflare ou aparelho físico.
