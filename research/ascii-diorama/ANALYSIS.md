# Análise técnica — ASCII Diorama na abertura do transmissor

Fonte inspecionada: `JDhruv14/ascii-diorama@3d3278a0f925aebddc574dfb7042eb1eb815f427`. O código original e a aplicação foram mantidos separados. Nenhuma mudança no front de produção nesta etapa.

## 1. Performance e viabilidade

### O que foi medido

Cena original em 1440×1440, Three.js 0.187.0, WebGL 2 no navegador integrado, GPU ANGLE/NVIDIA GeForce RTX 4070 Laptop. Somente uma cena aberta; nenhuma captura WebRTC simultânea.

| Medida | Resultado |
| --- | --- |
| Primeiro quadro, uma execução local | 6774 ms |
| Long tasks observadas na abertura | 618, 5930 e 175 ms |
| Amostras de quadro após aquecimento | 21.210 |
| GPU, query assíncrona, mediana / p95 | 3,02 / 4,47 ms |
| CPU de submissão e atualização, mediana / p95 | 0,20 / 0,40 ms |
| Cadência entre draws, mediana / p95 | 4,20 / 4,40 ms |
| Draw calls por quadro, incluindo sombras e pós | 27 |
| Triângulos reportados por quadro, incluindo sombras | 2.180.702 |
| Contagens do renderer | 17 geometrias e 14 texturas |

O loop original segue `requestAnimationFrame` sem limite explícito de FPS. A cadência medida pertence a este ambiente; não é promessa de taxa de apresentação em outro monitor. CPU de submissão não é tempo total de GPU. Contagem de texturas não mede VRAM. A abertura foi observada uma vez, com assets locais; não mede primeira visita em uma rede móvel.

**Leitura:** o quadro aquecido teve margem confortável para 60 Hz nesta GPU, mas a abertura bloqueou a thread principal por quase seis segundos em uma única tarefa. Não há prova de 60 fps em hardware médio, Android ou Safari físico. A técnica é utilizável em produção com adaptação; a cena pronta não deve entrar na interface sem trabalho de inicialização e ciclo de vida.

### Onde o custo está no código

- `reference/main.js:7–8`: resolução interna fixa 1440² e grade 200×100. Reduzir o tamanho CSS não reduz esse trabalho.
- Linhas 67–78: pré-cálculo do terreno em 600×626 células, buscando proximidade de aproximadamente 167 amostras do caminho por célula, além de ruído e rochas. É trabalho síncrono na thread principal.
- Linhas 87–119: bake de duas texturas RGBA em 2048×2140 e terreno com 480×500 subdivisões: 480 mil triângulos antes dos demais objetos.
- Linhas 187–266: 170 mil instâncias de grama, capacidade de 70 mil flores e folhas geradas em muitas copas. Instancing reduz draw calls, mas preserva trabalho de vértices, cobertura e memória.
- Linhas 445–455: sombra de 4096² com atualização padrão do renderer.
- Linhas 482–507: render de cena, passe ASCII e passe tilt-shift, com mipmaps. O blur usa até 36 amostras nas faixas desfocadas.
- Linhas 513–520: Espaço pausa o relógio, mas `drawFrame()` e o próximo RAF continuam. Não há tratamento de visibilidade, descarte ou movimento reduzido no original.

Só os dois render targets de cor com mipmaps representam aproximadamente 31,6 MiB de armazenamento lógico de texels. Esse cálculo exclui depth, sombra, terreno, vegetação, atlas, assets, buffers e overhead do driver; não é medição de VRAM. Existem ainda arrays e bakes retidos na CPU. Portanto, o download de 4.989.238 bytes não representa o uso de memória depois de carregar.

### Compatibilidade e avisos reais

O shader usa GLSL 3, `textureSize`, `texelFetch`, `textureLod` e derivadas explícitas: exige WebGL 2. O render target half-float precisa de suporte de renderização em float; o mapa de profundidade do mar usa FloatType com filtro linear. Validar extensões antes de alocar o cenário. Ausência de contexto, perda de contexto e erro de shader precisam de fallback na futura interface.

O teste renderizou sem erro de shader, com um aviso: `PCFSoftShadowMap` foi removido e Three.js 0.187.0 usou `PCFShadowMap`. Isso é fallback de compatibilidade, não falha total da cena. O upstream não informa a versão com que o autor produziu o visual; não se pode prometer correspondência de sombras entre versões. Ver [guia oficial de migração](https://github.com/mrdoob/three.js/wiki/Migration-Guide#181--182).

## 2. Referências e contexto

### O que torna esta implementação específica

O efeito não é só uma rampa de brilho. O cenário tem classes de material: grama, folha, flor, pedra, degrau, torii, madeira, areia, água, espuma, raposa, telhado e rocha. O vento influencia os traços da grama/água e o gradiente de luminosidade orienta caracteres nas bordas de determinados materiais. O fundo de cada célula conserva uma versão escurecida do render. A composição do cenário e o foco central são partes do resultado, não decoração intercambiável do shader.

O código tem três camadas autorais que devem ser avaliadas juntas: a miniatura em 3D, as regras de glyph por superfície e o tilt-shift. Copiar só os shaders para uma cena sem os IDs corretos não reproduz o resultado.

### Comparação verificável

[Beyond the Luminance Ramp — Codrops, 04/09/2026](https://tympanus.net/codrops/2026/09/04/beyond-the-luminance-ramp-a-shape-aware-ascii-renderer-in-three-js/) documenta outra solução ASCII em Three.js, com busca por forma entre 95 caracteres e um alvo dedicado com um fragmento por célula. O diorama usa 29 caracteres e regras por material/gradiente, não aquela busca de forma. No diorama, a decisão por célula é recalculada no passe de resolução completa. Separar essa decisão em um alvo na resolução da grade é uma hipótese concreta de otimização, ainda não implementada ou medida aqui.

As consultas realizadas não estabeleceram uma premiação Awwwards deste repositório nem de uma implementação idêntica. O acesso direto à página consultada de Dragonfly no Awwwards falhou. Não se atribui prêmio ou algoritmo de outro site a este código. A comparação se limita às implementações documentadas acima.

### Licença

Código MIT com aviso preservado. As seis texturas são CC0 segundo [Poly Haven](https://polyhaven.com/license). A raposa exige os créditos de rig/animação e conversão informados no [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox). Consulte `ATTRIBUTION.md` e o manifesto antes de uma publicação.

## 3. Arquitetura e abordagem para esta interface

### Pipeline confirmado

1. Construção procedural do terreno, vegetação, objetos e mar; carregamento de texturas e raposa.
2. Materiais gravam RGB e ID de superfície em A no alvo half-float. A raposa usa material não iluminado no original.
3. Passe ASCII amostra a cor no mip correspondente ao tamanho da célula e recupera a classe sem interpolação. Brilho, classe, ruído temporal e direção da borda escolhem o glyph.
4. O atlas é rasterizado em Canvas2D com fonte monospace do sistema. `textureGrad` usa derivadas da grade contínua para evitar emendas do UV descontínuo do atlas.
5. Tilt-shift desfoca longe da faixa em torno de 42% da altura. A câmera percorre a miniatura com movimento suave.

### Partes difíceis reais

- Inicialização síncrona do terreno e do bake é mais problemática para a usabilidade do que o tempo aquecido da GPU medida. Preservar os dados em bake offline ou mover o preparo compatível para worker deve vir antes de remover elementos visuais.
- A área atual das esferas no host usa 12 rem em telas estreitas. Com base 16 px, são 192 px: 200 colunas dariam menos de 1 px CSS por célula. É necessário ajustar grade e área da miniatura, com revisão visual; reduzir só o canvas interno não resolve leitura dos caracteres.
- O filtro depende do canal alfa como classificação. Transparência convencional de materiais pode corromper esse contrato.
- O atlas depende da fonte monospace disponível; o mesmo texto de fonte não assegura desenho idêntico entre Windows e Safari. Uma fonte/atlas fixado pode ser necessário para fidelidade.
- O tempo da câmera vai e volta em 48 segundos, embora DURATION seja 24. Raposa e partículas têm períodos próprios; exportar um vídeo em loop requer validar a emenda do conjunto, não apenas cortar 24 segundos.
- A fonte original anexa o canvas ao body e altera estilos globais. A adaptação precisa controlar apenas o elemento visual do host.

### Direção proposta, ainda sem integração

Manter o cenário e o tratamento visual como referência. Criar um módulo montável apenas no `card-icon` do modo host, com `mount/start/stop/dispose`, assets locais e resolução interna limitada ao tamanho real do bloco. O primeiro ajuste deve ser de área/grade/resolução e de bake, preservando os elementos da miniatura até revisão visual. O tamanho final não foi aprovado nem medido no host.

Carregar o módulo sem bloquear a ação Selecionar tela. O pedido `getDisplayMedia()` continua síncrono no gesto e não espera import, imagem ou animação. Ao começar a captura, parar RAF e liberar os recursos decorativos; apenas esconder o canvas não basta. Ao encerrar, a abertura poderá voltar. Fora de tela e em aba oculta, parar o trabalho. Movimento reduzido deve oferecer quadro estático; falta de WebGL 2 ou extensão deve usar uma imagem local, mantendo a interface funcional.

Como o efeito é decorativo, uma entrega pré-renderizada também é tecnicamente possível e pode preservar o visual com menos preparo de CPU. Não foi gerada, nem foi escolhido um codec ou um loop final nesta etapa. Não substituir o diorama por uma animação ASCII genérica para economizar trabalho.

### Critérios para a futura integração

- Nenhum import Three.js, request de asset ou canvas extra no modo espectador.
- Nenhuma alteração na espera do espectador, no player, volume, miniatura, histórico ou sinalização.
- Botão Selecionar tela utilizável antes do efeito estar pronto; falha visual não bloqueia captura.
- Nenhum draw decorativo enquanto a captura estiver ativa; nada de RAF em modo reduzido estático.
- Descarte de render targets, atlas, materiais, geometrias, texturas, listeners e contexto no encerramento do componente.
- Validar início/reinício, troca de aba, perda de contexto, Android/Safari físicos e uso simultâneo com captura.

## 4. Preparação executada

Clone separado e intacto, cópia fiel de `main.js`, sete assets verificados por formato e SHA-256, dependências e lockfile próprios, módulos extraídos com licença, preview local e instrumentação reproduzível. Render original verificado visualmente, sem erro de shader; aviso de sombra registrado. O resumo medido está em `baseline-summary.json` e o registro completo local em `artifacts/baseline-1440.json`.

Nenhum arquivo de runtime do bot foi modificado para importar este estudo. A substituição das esferas ainda não foi feita.
