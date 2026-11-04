# Abertura do diorama: otimização medida

Revisão local de 03/11/2026. O objetivo é reduzir o tempo até o primeiro quadro animado preservando o tamanho, densidade e movimento aprovados.

## 1. Diagnóstico e viabilidade

A primeira execução instrumentada registrou 2166 ms dentro do worker e 2285 ms desde a navegação até receber `ready`. Desse preparo, 112 ms eram de alturas, 673 ms de bake de cor/terreno e 884 ms de geração de objetos. O custo dominante era CPU estática repetida a cada abertura; aumentar prioridade de download ou esconder o atraso com uma foto não removeria esse trabalho.

O render continua em 768²/128×64 caracteres nas áreas maiores e 512²/96×48 nas menores, limitado a 30 desenhos/s. Mantidos 27 draw calls e 1.374.302 triângulos incluindo sombras. Esta revisão não mede tempo de GPU ou fps sustentados.

## 2. Fundamentos

Os campos de altura, a cor/classe do terreno e as posições aceitas da vegetação são determinísticos no código original. Podem ser calculados no build sem substituir os shaders de vento ou a animação da raposa. O algoritmo de origem e a versão consultada continuam identificados em [host-diorama.md](host-diorama.md).

O [Sharp](https://sharp.pixelplumbing.com/api-resize/) prepara variantes no build e não entra no navegador. A [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) permite descomprimir os dados no worker. Compilar shaders e executar o primeiro render continuam sendo etapas de GPU/navegador, conforme a [documentação do Three.js](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync); não foram substituídas por um timer ou uma imagem.

## 3. Arquitetura

- `world.mjs` compartilha a matemática original com o build. Os campos mantêm Float32 e a seleção de posições mantém o gerador e sua sequência.
- `scene-data.mjs` grava os campos e pequenos contadores das amostras rejeitadas. No worker, repetir somente os passos inteiros do gerador recompõe os estados aceitos, sem repetir as buscas de ruído/terreno. Não se transfere uma matriz completa para cada uma das 240 mil instâncias de grama/flores.
- O formato valida versão, dimensões, contagem, tamanho e sequência final. Há limite para a repetição de passos em dados corrompidos.
- O mapa de cores do terreno usa WebP **sem perdas**; o mapa de classes usa PNG **sem perdas**. As quatro texturas de detalhe efetivamente usadas são preparadas em 512²/WebP qualidade 90. Os originais continuam em `effects/diorama/assets`.
- `build-diorama.mjs` gera os arquivos com hash e inclui seus nomes no bundle. Dados/texturas podem usar cache sem misturar versões. O build confere o destino antes de limpar somente o diretório gerado.
- Modelo e dados/texturas começam a carregar juntos. As instâncias mantêm seus buffers e materiais; somente arrays de colocação temporários são liberados após a montagem.
- O ciclo de captura permanece igual: o worker é encerrado antes de `getDisplayMedia`, sem adiar a ativação do usuário. A foto permanece exclusiva do fallback.

## 4. Resultado e limites

Três recargas por versão, mesmo navegador local, largura útil 1265 px, perfil 768². Assets servidos pelo mesmo servidor de QA sem cache HTTP; cache de shaders do navegador já aquecido. `pageReadyMs` é o recebimento do primeiro quadro pronto desde a navegação, antes de completar o fade existente de 240 ms.

| Versão | Até quadro pronto, ms | Mediana | Worker, mediana |
|---|---|---:|---:|
| Anterior | 1887, 1862, 1857 | 1862 ms | 1806 ms |
| Final, terreno sem perdas | 533, 541, 521 | 533 ms | 455 ms |

Redução observada de aproximadamente **71%** no tempo mediano desde a navegação. É uma comparação local com seis execuções, sem simular conexão móvel nem reiniciar o cache de shaders a cada teste. Não é promessa de meio segundo em todo dispositivo/rede.

Texturas/modelo antes: **4.989.238 bytes**. Recursos de cena finais, incluindo dados pré-calculados: **2.401.969 bytes**, aproximadamente 52% menos. O bundle JS, próximo de 676 KB antes da compressão HTTP, está excluído dos dois totais; não é uma medição do peso total da página.

Conferências adicionais:

- Hash SHA-256 dos buffers de posição, matrizes e cores de grama/flores/troncos/folhas idêntico ao código anterior: `dee941b52f48f9c422f6cdb3883b31b057755f677e1b242c25b1d81e1a84706e`. Inclui 170 mil instâncias de grama, 70 mil flores e 172.260 folhas.
- Mapa de classes e mapa de cores do terreno conferidos byte a byte contra os dados do bake: erro zero após decodificar seus arquivos. Isso não afirma igualdade entre resamplers distintos nem entre os JPEGs originais e as variantes WebP de detalhe.
- Perfil menor chegou a `running` com 512²/96×48, mantendo 27 draw calls. Conferência em janela de 390 px, 375 px úteis; não é aparelho móvel físico.
- 39 testes e build Wrangler em dry-run passaram. Os testes incluem round-trip dos dados, arquivos truncados/versão errada, limite de repetição e as verificações anteriores de captura, ciclo de vida e player.

Os comparativos e verificadores temporários estão em `.wrangler`; os JSONs e a captura de tela ficam na pasta de visualizações desta sessão. O build público não contém código de benchmark nem os recursos antigos sem uso. Não houve publicação.
