# Gelo fragmentado na transmissão — 06/11/2026

> Estudo histórico encerrado em 06/11/2026. Os efeitos e seus módulos de runtime foram removidos a pedido do usuário. Preparação e transmissão usam agora o [oceano com tubarões](quality-ocean.md).

Pedido: substituir os flocos de aparência infantil por um tratamento mais
complexo de gelo, preservando pétalas, sangue, controles e a cena contínua.
A pesquisa e a implementação foram autorizadas na mesma solicitação.

## 1. Performance e viabilidade

O limite de raster permanece em 240 mil pixels, DPR 1,5 e 1536 por dimensão.
A nova refração acrescenta um alvo RGBA8 sem depth, mipmaps ou buffers float.
Armazenamento lógico de texels do alvo: no máximo 960.000 bytes, sem contar
framebuffer de apresentação, buffers, CPU, driver ou demais efeitos da tela.
Ele é realocado apenas quando o raster muda de dimensão.

Agora são três chamadas por quadro: fundo para textura, cópia para apresentação
e partículas instanciadas. Um canvas/contexto, três programas, um VAO, um buffer
de instâncias, uma textura e um framebuffer. A população de 174/108 e a grade
compartilhada de 64 triângulos por instância permanecem. Não há import Three.js,
modelo externo, bloom, textura fotográfica ou renderização da interface HTML.

O custo novo mais importante é de fragmentos: camadas de névoa no segundo card,
refração com três amostras RGB e duas interseções de doze planos nos fragmentos
congelados maiores. Poeira fina usa um caminho simplificado. Isso é mais caro
que o shader anterior; as contagens não são benchmark nem garantia de 60 fps.
No mobile há menos instâncias e o alvo acompanha o orçamento de raster.

O alvo utiliza recursos centrais de WebGL2, sem exigir render em float.
Framebuffer incompleto, falta de contexto ou erro de shader mantêm os cards
estáticos. A alocação incompleta é tratada como falha e descarta todos os recursos.
Pausa, movimento reduzido, cores forçadas, contexto, bfcache e captura conservam
o controlador existente. A troca para o oceano libera a textura de refração.

## 2. Referências verificadas

### Igloo Inc., Abeto / Bureaux

[Case de 31/10/2024 no Awwwards](https://www.awwwards.com/igloo-inc-case-study.html),
lido no navegador após o extrator HTTP falhar. A equipe descreve variação de
blocos, um algoritmo próprio de crescimento de cristais para modelagem,
iteração de shaders e arte diretamente no navegador e medição de performance.
Também descreve um exportador de dados VDB para a seção de partículas.

A aplicação aqui é de direção: gelo como material e estruturas distintas, não
um símbolo de neve repetido. Não usamos o algoritmo de crescimento, exportador
VDB, assets ou shaders privados do site e não atribuímos nosso ray/plane clipping
ao autor. O case não é uma especificação completa do material de gelo deles.

### Jesper Vos — refração em tempo real

[Real-time Multiside Refraction in Three Steps, Codrops 2019](https://tympanus.net/codrops/2019/10/29/real-time-multiside-refraction-in-three-steps/)
documenta captura do fundo, distorção por normal/IOR, Fresnel e um passe de
normais traseiras. Explica as limitações da refração em espaço de tela e da
composição de vários objetos transparentes em cadeia.

Nossa implementação calcula planos de entrada/saída analiticamente, sem o alvo
de normais traseiras daquele estudo. Conserva o princípio de capturar o fundo
fora do objeto refrativo para evitar ler e escrever a mesma textura no desenho.

### Propriedades ópticas

[Material de óptica, University of Wisconsin](https://user-web.icecube.wisc.edu/~karle/courses/phys202/202lecture22_Ch35.pdf)
lista índice óptico de gelo de aproximadamente 1,309. O shader usa 1,31 como
aproximação escalar. Não é um modelo espectral, anisotrópico ou calibrado de gelo.
Separação RGB pequena, absorção, frost e iluminação foram dirigidos artisticamente.

## 3. Arquitetura implementada

`public/ice-material.mjs` fornece o campo de movimento local e os blocos GLSL.
`public/quality-elements.mjs` compõe o material com o batch e a transição existentes.

### Forma e refração

Volumes convexos são definidos por doze planos: paredes assimétricas, pontas,
frente/verso e bevels. Rotação em três eixos altera faces visíveis e caminho óptico.
Cada fragmento é resolvido somente dentro do quad da partícula; não existe um
raymarch de tela inteira. A silhueta de morph continua SDF e converge para o
volume congelado. As trajetórias principais mantêm identidade entre os cards.

O raio da câmera encontra a face de entrada. `refract` fornece a direção dentro
do corpo; uma segunda interseção encontra a saída e uma segunda refração calcula
a direção emergente. Espessura atravessada modula a absorção. Fresnel regula a
reflexão, com um ambiente analítico de faixas de luz. Uma pequena separação dos
canais RGB sugere dispersão. Não há cadeia de reflexões internas: no caso de
reflexão interna total a contribuição refletida do ambiente é aproximada.

O fundo capturado inclui atmosfera e superfície dos cards. Não inclui as outras
partículas ou o vídeo real/HTML. Coordenadas de amostragem são limitadas à janela
atual, evitando vazamento das cores vizinhas e dos rótulos. A refração não pode
mostrar objetos fora desse fundo nem atravessar vários fragmentos em cadeia.

Fraturas e inclusões são avaliadas nas coordenadas do objeto, acompanhando sua
rotação. São marcas procedurais de material, não uma simulação de rachadura ou
planos internos rastreados fisicamente. As inclusões de alta frequência são
atenuadas por derivadas para reduzir cintilação quando menores que um pixel.

### Escalas e atmosfera

A antiga função de floco de seis braços foi removida. Uma parte da população
local forma lascas maiores, de tamanho nominal 22–36 px, com avanço e giro lentos.
O restante é poeira fina de menos de 3 px. Partículas principais ficam um pouco
maiores no estágio de gelo e retornam à escala da gota ao entrar no sangue.

Névoa tem quatro camadas deslocadas de densidade procedural, deriva comum e
composição progressiva. É uma aproximação de profundidade; não é integração de
transporte volumétrico de luz em 3D. Na borda direita há frost fraturado por
distância entre células, com facetas de intensidade irregular. O conjunto recebe
luz suficiente para tornar gelo translúcido legível sobre o fundo escuro, sem
ocupar a faixa reservada ao texto.

## Verificação e limites

Testes de movimento verificam tamanhos distintos, dados finitos, continuidade,
desaparecimento nos resets e deslocamento entre layouts. O teste do controlador
verifica reutilização e redimensionamento do alvo, descarte completo após falha,
troca de cena e os recursos já cobertos. Os mocks não verificam ótica física.
Shaders e leitura visual são revisados no Chromium local com transmissão
sintética, separadamente de build e testes. Sem publicação ou alegação de
performance em captura real, Safari/iOS/Android físicos.

Revisão concluída: 135 testes e build em dry-run passaram. Verificação HTTP de
seis telas e doze assets aprovada. No Chromium standalone, os shaders compilaram
sem erro/aviso; clique, setas, parar e reiniciar a transmissão sintética funcionaram.
O retorno ao oceano manteve um canvas no grupo. Registros em
`artifacts/ice-refinement/`.

O layout compacto foi revisado em iframe local com largura externa de 390 px,
área útil/scrollWidth de 375 px e cards empilhados de 160 px, sem overflow
horizontal. O gelo renderizou nessa janela. O console do invólucro de revisão
registrou um erro de MutationObserver sem origem confirmada; não se atribuiu
esse erro ao material e não se declarou o console desse invólucro limpo. A
página temporária e a alteração temporária do servidor foram removidas. Isso
verifica um layout estreito, não navegador ou hardware de um telefone físico.
