# Olhos neon de identificação

Direção aprovada em 04/11/2026: os pares de olhos neon são a apresentação definitiva dos espectadores durante a transmissão, diferenciando íris e pupilas. `worker.js` ativa o mesmo módulo na interface real; o menu local tem uma única tela **Transmitindo**. A implementação anterior de máscaras, seus cinco bitmaps, catálogo, estilos e harness foram removidos.

## 1. Performance e viabilidade

`public/audience-eyes.mjs` desenha um par inteiro por chamada em um canvas WebGL 2 compartilhado. Não há texturas, carregamento de imagens, framebuffers de pós-processamento ou bloom multipass. O buffer tem 68 CSS px de largura, DPR limitado a 2 e altura física limitada a 2048 px. Os olhos ocupam 68×32 CSS px ao lado do apelido.

O brilho é analítico e localizado: borda emissiva da íris, luz curta sobre a esclera e halo calculado pela distância à abertura. O custo depende da área desenhada e quantidade de pares visíveis. Há RAF nos deslocamentos do olhar e um timer nos intervalos, sem pulso contínuo. Aba oculta interrompe ambos. Movimento reduzido, perda de contexto ou falha de WebGL conserva o par em SVG estático. Não há medição de 60 fps em hardware médio, Safari ou transmissão física nesta revisão.

## 2. Referências e contexto

- [The Book of Shaders — Shapes](https://thebookofshaders.com/07/): campos de distância, suavização de bordas e construção de formas por funções. Base para os formatos distintos das pupilas e os padrões polares.
- [Kyle Tugwell — Procedural Eye Shader](https://www.kyletugwell.com/projects/procedural-eye-shader): separação entre íris, esclera, córnea e parâmetros de material. O estudo do autor usa Blender/Substance/UE; esta implementação é própria em GLSL e não reproduz esse pipeline.
- [Codrops — Dissolve com shaders e partículas](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/): distingue emissividade, reflexos e bloom seletivo. Aqui somente o conceito de emissão localizada é aproveitado; não há partículas ou Unreal Bloom.
- [MBS — Leonardo e os “Olhos dos Deuses”](https://www.mbs.jp/kekkaisensen/sp/select/list/12828.shtml): direção para anéis luminosos e sensação de visão sobrenatural no azul. Os visuais dos [Six Eyes/Gojo](https://jujutsukaisen.jp/character/category6.php) também informam a ideia de uma íris clara com profundidade.
- [NARUTO oficial — Mangekyō](https://naruto-official.com/en/news/01_2424): direção de alto contraste entre o símbolo escuro e a íris vermelha. O sigilo de três lâminas e os anéis do azul são interpretações próprias para esta escala de interface.
- `public/host-live-eye.mjs`: referência interna para projeção da íris sobre esfera, recorte fixo da pálpebra e proteção da pupila contra reflexos excessivos. O indicador Sharingan do transmissor foi preservado.

## 3. Arquitetura e aparência

As cinco definições e o shader ficam no mesmo módulo. Azul-claro usa abertura mais ampla, esclera clara, núcleo pequeno, bandas de profundidade e órbitas brancas interrompidas. O vermelho usa abertura mais estreita e inclinada, esclera quase preta e um sigilo negro de três lâminas curvas ligado à pupila central. Esses desenhos substituem as antigas facetas azuis e o diamante vermelho. Amarelo conserva fibras radiais e fenda vertical; verde conserva fibras curvas, dois anéis e fenda horizontal; roxo conserva três braços em espiral e pupila de quatro pontas. São identidades visuais estilizadas, sem alegação anatômica.

Cada metade do mesmo viewport contém um globo. O olhar é compartilhado dentro do par, enquanto cada espectador tem uma fase própria. A projeção esférica desloca a íris sob uma abertura fixa. Fibra, anel, pupila e reflexo são calculados por pixel, com suavização por derivadas para a escala do ícone. A imagem do SVG de fallback mantém dois olhos e os mesmos formatos de pupila.

O controlador sorteia o estilo para cada nova conexão, usando `Math.random` e mantendo o resultado em memória pelo número estável da conexão na sessão. Atualizar o apelido ou reconstruir a lista não refaz o sorteio. Estilos ainda livres têm prioridade: até cinco conexões simultâneas recebem estilos diferentes; acima disso, as repetições são distribuídas entre os menos usados. Ao sair, a conexão libera seu estilo. Recarregar a página inicia novos sorteios. O apelido permanece texto no DOM; o desenho é decorativo e não recebe cliques. Observadores e listeners têm descarte explícito. A montagem acontece uma única vez no módulo do host, sem flag de estudo. Apenas `scripts/preview.mjs` cria os cinco espectadores sintéticos da prévia. Não há seletor ou envio de estilo ocular no protocolo real.

## 4. Validação e limites

Os testes de `tests/audience-eyes.test.mjs` verificam continuidade do olhar, cinco variantes estáveis, um contexto, ausência de upload de texturas, pausas, recriação ao rolar, fallback e descarte. O harness local `.wrangler/render-audience-eyes.py` adapta somente o cabeçalho GLSL para OpenGL desktop e renderiza o mesmo shader em três posições e no tamanho de entrega. Uma segunda passagem renderiza azul e vermelho com a mesma cor neutra e compara os pixels para confirmar que a diferença está também na geometria/material. O custo permanece um draw por par, sem texturas ou passes adicionais na página; as formas são avaliadas por funções de distância no shader existente. A inspeção de GPU não valida alinhamento DOM/canvas, disponibilidade de WebGL no navegador nem outros equipamentos.

Regressão visual: sempre dois olhos da mesma variante, pupilas distinguíveis, halo sem apagar a forma central, direção conjunta dentro do par, permanência da identidade ao trocar apelido, alinhamento após scroll/resize e SVG legível com movimento reduzido. A aprovação visual do usuário usa os olhos desta implementação. As variantes de transmissão sem olhos foram retiradas do índice local; áudio e encerramento são estados exercitados na mesma tela.

Consolidação verificada com 86 testes, build em dry-run e checagem HTTP das seis telas do menu. No Chromium local, os cinco pares aparecem por padrão; adicionar um espectador anônimo preservou as cinco identidades anteriores e manteve um único canvas de plateia. O controle de áudio da prévia alternou o indicador e encerrar limpou os espectadores e liberou o renderer. Em viewport de 390 px, a largura do documento ficou em 375 px com scrollbar, sem overflow horizontal. Esses testes usam mídia e transporte sintéticos; não comprovam desempenho em celular físico ou transmissão entre redes.
