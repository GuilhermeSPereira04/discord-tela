# Oceano ASCII nos perfis de imagem — 05/11/2026

Protótipo integrado à preparação e à transmissão: três cards são janelas para
um único mar visto de cima. Desde 06/11/2026, o mesmo oceano com tubarões aparece
nas duas etapas. Os efeitos de pétalas, gelo e chuva foram removidos do código.
O controller mantém o renderer e o tempo de animação ao mover o fieldset;
redimensiona o canvas e atualiza as máscaras conforme o novo layout.

## Performance e viabilidade

`public/quality-ocean.mjs` usa WebGL2 sem Three.js ou assets de modelos. O primeiro
passe avalia água, cinco silhuetas deformáveis e seus materiais uma vez por célula
ASCII. O segundo desenha os caracteres e as três máscaras arredondadas em uma
única chamada. São dois draws por quadro, um framebuffer RGBA8 sem profundidade,
uma textura de cena e um atlas Canvas2D. Não há alocações de textura nem leituras
de layout no loop; dimensões e retângulos são atualizados por eventos/observadores.

A grade nominal usa células de 5 × 8 px CSS, limitada a 16 mil células e 512 por
dimensão. O raster final é limitado a 360 mil pixels, DPR 2 e 2048 por dimensão.
O alvo RGBA8 ocupa no máximo 64 mil bytes de texels; o atlas 928 × 56 ocupa
207.872 bytes lógicos RGBA, sem mipmaps. Isso exclui o framebuffer de apresentação,
buffers internos, armazenamento Canvas2D e overhead do navegador; não é medida
de VRAM. O diorama possui seu próprio contexto e continua com seu ciclo de vida.

O loop tem teto de aproximadamente 60 draws de quadro por segundo. Não comprova
60 fps sustentados, tempo de GPU ou desempenho simultâneo com captura real.
Movimento reduzido, cores forçadas, falha WebGL ou shader preservam cards estáticos
com os controles HTML. Aba oculta, elemento fora de tela e seleção de captura
param o RAF. A troca entre preparação e transmissão reutiliza programas, texturas e framebuffer.
O descarte ocorre ao sair da página, desmontar o efeito ou falhar no desenho.

## Referências e diferenças

Base: [JDhruv14/ascii-diorama](https://github.com/JDhruv14/ascii-diorama), commit
`3d3278a0f925aebddc574dfb7042eb1eb815f427`, MIT. Reutilizados o repertório de
caracteres, construção do atlas e princípio de classificação por material e
direção de borda. O aviso MIT está incluído no módulo servido.

As regras foram especializadas para água, reflexos e tubarões, sem a classificação
da raposa, vegetação ou desfoque tilt-shift. A avaliação da cena em resolução da
grade também difere do diorama, cujo passe ASCII avalia a decisão por pixel final.

O estudo prévio de [steering de Craig Reynolds](https://www.red3d.com/cwr/steer/Wander.html)
orientou a análise de continuidade. Este protótipo não implementa wander/boids:
usa trajetórias analíticas com tangentes, curvas largas e desvio local suavizado.
Água e linhas de interferência são procedurais; não são cáusticas físicas, refração
ou simulação de fluido. Os animais são silhuetas SDF com sombreamento de volume,
não modelos 3D ou um estudo biomecânico de nado.

## Cena e interação

O espaço é o retângulo inteiro do grupo, incluindo intervalos entre cards. A máscara
recorta a apresentação depois da decisão ASCII; não reinicia coordenadas ou fase.
Os cinco animais têm tamanho, profundidade, direção, período e cadência próprios.
Uma onda lateral cresce em direção à cauda; o nariz fica relativamente estável.
O wrap ocorre somente fora das bordas externas, com o animal totalmente oculto.

O ponteiro usa coordenadas de layout em cache e um filtro temporal. Ele perturba
a água e desloca suavemente as curvas próximas. Touch não mantém hover. Uma
mudança do radio emite uma onda no card selecionado, inclusive pelo teclado;
a escolha funcional continua imediata e não espera essa decoração.

No desktop o percurso principal é horizontal; com cards empilhados ele passa a
vertical. O desenho continua no espaço comum. Textos ficam em HTML, na faixa
inferior protegida por sombreamento no shader e um véu CSS. Foco e seleção usam
os radios e bordas existentes.

## Validação

Os testes exercitam continuidade nas três janelas e wrap externo em ambos os
layouts, limites de raster/grade, ausência de leitura de layout por quadro,
reutilização do alvo, pausa na captura, troca de etapa sem recriar o renderer, restauração
de contexto e bfcache. Os mocks verificam ciclo de vida, não compilação GLSL
ou desempenho. A compilação real e o layout são revisados no Chromium local.

Revisão local inicial: 118 testes e build Worker em dry-run passaram; seis rotas e nove
assets foram verificados por HTTP. No Chromium, o grupo em desktop mediu 512 ×
240 px CSS; em viewport de 390 px, 356,3 × 496 px CSS, sem overflow horizontal.
Clique e setas alteraram o radio e o texto explicativo. Na captura sintética,
o modo mudou para `live-flow`, o diorama ficou sem canvas e o oceano voltou
ao parar; o reinício sintético também funcionou. Sem avisos/erros no console
durante essa revisão. Imagens em `artifacts/quality-ocean/`. Não houve captura
real, publicação, benchmark de GPU nem teste em Safari/Android/iOS físicos.

## Cards ampliados e espécies

O grupo da preparação passa de no máximo 32 para 36 rem. Cada card passa de
15 para 18 rem de altura no desktop e de 10 para 12 rem no layout empilhado.
Rótulos e seleção mantêm a faixa inferior protegida. Os limites de raster,
grade, texturas, framebuffer e dois draws por quadro permanecem os mesmos;
há mais células e avaliações de silhueta na cena do que na revisão anterior.

A população passa a cinco: dois brancos de tamanhos diferentes, um martelo,
um tigre e um animal menor de silhueta esguia. Os brancos têm torso mais largo,
cauda com lóbulos mais equilibrados e dorso cinza claro. O martelo tem a cabeça
transversal unida a um corpo fino; o tigre recebe focinho mais largo e barras
escuras irregulares nos flancos, presas às coordenadas que ondulam com o corpo.
As faixas são largas para resistir à quantização da grade ASCII. Os tamanhos
e pigmentos são escolhas artísticas para leitura em miniatura, não escala
comparativa ou reconstrução científica dos animais.

Referências anatômicas primárias: Florida Museum, [great hammerhead](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/great-hammerhead/),
[white shark](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/)
e [tiger shark](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/tiger-shark/).
Cada perfil conserva período e cadência próprios; os cinco atravessam as três
janelas e fazem wrap somente fora do retângulo externo, também no empilhamento.

Revisão das espécies: 119 testes e build em dry-run passaram. No Chromium local,
grupo de 576 × 288 px em desktop; em viewport de 390 px, três cards com 192 px
de altura, sem overflow horizontal. Martelo, corpo maior dos brancos e barras
do tigre foram conferidos nas duas orientações, sem erro/aviso de console.
Imagens em `artifacts/quality-ocean-species/`. Os testes de trajetória cobrem
agora os cinco perfis e o reinício só fora do mundo; os demais limites de
validação da revisão anterior permanecem, inclusive ausência de benchmark físico.

## Paleta unificada

A pedido do usuário, os cards seguem azul-mar (Nítida), verde-esmeralda (Fluida)
e vermelho-vinho (Leve) nas duas etapas. A atualização de 06/11/2026 preserva
o vermelho anterior. Bordas, radios e fundos estáticos usam as mesmas
variáveis CSS nas duas telas. O passe ASCII aplica a cor depois de escolher os
caracteres pela luminosidade original: mantém silhuetas, volume e listras do
tigre. A água recebe o tom da janela; os animais recebem um pouco de luz neutra
para conservar leitura. Não há passes, partículas ou texturas adicionais.
