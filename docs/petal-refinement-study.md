# Refinamento das pétalas — pesquisa de 06/11/2026

> Estudo histórico encerrado em 06/11/2026. Os efeitos e seus módulos de runtime foram removidos a pedido do usuário. Preparação e transmissão usam agora o [oceano com tubarões](quality-ocean.md).

Escopo original: estudar física, movimento, forma, material e ar para o primeiro card da
transmissão. A etapa de pesquisa não alterou o runtime. A implementação autorizada
posteriormente está registrada em [quality-elements.md](quality-elements.md).
A cena estudada é uma
interpretação de Senbonzakura; não é reprodução do pipeline do anime, que não
foi identificado. As conclusões de custo abaixo são análise, não benchmark.

## 1. Performance e viabilidade

O runtime atual (`public/quality-elements.mjs`) compartilha 174 instâncias no
desktop, das quais 72 são viajantes e dez são pétalas locais. No empilhamento
são 108 instâncias, com 42 viajantes e oito pétalas locais. São seis vértices
por instância, fundo + partículas, raster máximo de 240 mil pixels e nenhum
render target/textura intermediária. As superfícies são quads com formas SDF.

A candidata mais adequada é uma malha pequena de superfície curva, instanciada,
com estado de posição/velocidade e orientação/velocidade angular. Um ensaio com
32–64 triângulos por pétala equivaleria a 2.624–5.248 triângulos para as 82
instâncias potencialmente portadoras de pétalas no desktop. É uma estimativa
de orçamento, não uma escolha de topologia validada. Dependendo da passagem
para gelo e gotas, pode ser necessário um batch próprio; não prometer manter
dois draws antes de definir essa integração.

As alternativas têm custos distintos:

| Abordagem | CPU | GPU/memória | Avaliação |
| --- | --- | --- | --- |
| Curvas analíticas + quad atual | pequena avaliação por partícula | mínima geometria, custo de transparência | barato, mas não acopla orientação e deslocamento |
| Corpo fino com aerodinâmica reduzida + malha curva | estado e integração de poucas dezenas de corpos | mais vértices, normais e atributos; possível atlas pequeno | candidata para os cards |
| Tecido auto-colidente + fluido acoplado | solver ou preparo offline importante | buffers/solver adicionais | exige um estudo separado; não há justificativa visual para começar por aqui |

Para a escala atual, o solver reduzido pode começar em arrays tipados na CPU.
GPGPU não é condição para qualidade e adicionaria alvos ping-pong e integração
de estado desnecessários antes de uma medição. É necessário observar o custo de
transparência/overdraw e do novo material, e não apenas contar triângulos.

Não há prova de 60 fps em hardware médio ou junto da captura real. Manter as
pausas por visibilidade, seleção de fonte, movimento reduzido, descarte e
restauração do contexto já existentes. Safari/mobile exigem revisão física,
especialmente de brilho, detalhes subpixel e quedas de cadência. Uma malha sem
texturas float pode evitar introduzir novas exigências de render targets.

## 2. Referências e contexto

### Forma botânica

[Flora of New Zealand — Prunus serrulata](https://nzflora.info/factsheet/taxon/Prunus-serrulata.html)
descreve pétalas amplamente obovadas a orbiculares, onduladas e entalhadas, com
dimensões variáveis e coloração branca a rosa. Isso sustenta uma lâmina larga,
ápice com entalhe e variação de contorno. Não implica que todos os cultivares
tenham uma única forma exata, nem que toda pétala precise ser rosa saturada.

### Física de queda de corpos finos

[Andersen, Pesavento e Wang, JFM 2005](https://dragonfly.tam.cornell.edu/publications/S002211200500594Xa.pdf)
estudam placas em fluxo quase bidimensional, com medições, Navier–Stokes e
modelos de forças. Identificam flutter (oscilação lateral), tumble (rotação com
deriva) e regimes dependentes de geometria, inércia e condições do fluido. O
trabalho também destaca a contribuição da rotação à circulação. A página do
[grupo de Cornell](https://dragonfly.tam.cornell.edu/falling_paper.html) reúne
explicações e vídeos. Esses resultados não são uma calibração para pétalas
flexíveis de sakura em ar: a transferência para os cards é uma aproximação.

### Ar procedural

[Bridson, Hourihan e Nordenstam, SIGGRAPH 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf)
constroem campos de velocidade a partir de curl noise, com controle espacial
e condições de contorno. O princípio permite descrever turbulência sem resolver
um fluido completo. Usar curl como deslocamento sobre uma curva pronta não é
o mesmo que integrar a velocidade de uma partícula sob forças aerodinâmicas.

### Material e luz

[Wilmsen, Dyer e Lunau, Journal of Pollination Ecology 2021](https://pollinationecology.org/index.php/jpe/article/view/606)
medem refletância de pétalas de 39 espécies e investigam o efeito da
microestrutura da epiderme na aparência, incluindo redução de gloss por células
cônicas. Não se atribui uma medida específica a sakura a partir desse estudo.
Sua relevância aqui é que o aspecto de pétala não deve ser reduzido a uma
superfície lisa de plástico rosa.

[Barré-Brisebois e Bouchard, GDC 2011](https://media.gdcvault.com/gdc2011/slides/Colin_BarreBrisebois_Programming_ApproximatingTranslucency.pdf)
apresentam uma aproximação de translucência em tempo real modulada por espessura.
É referência para luz posterior tingida e controle de espessura; não comprova
fidelidade física de um shader específico para pétalas nem exige usar o pipeline
completo da palestra.

### Implementação visual documentada

[Thibault Introvigne, Gommage, Codrops 2026](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/)
usa geometria de pétalas, dobra ponderada pelo UV, rotação nos três eixos e
variação por seed. O material mostrado é MeshBasicNodeMaterial e o pipeline é
WebGPU/TSL; não se deve atribuir física aerodinâmica ou iluminação física de
pétala ao autor a partir dessas rotações. É um exemplo verificável de deformação
geométrica em vez de somente estreitar um sprite.

Não foi verificada premiação Awwwards dessas implementações específicas. As
referências acima são de pesquisa científica e técnica, com alcance explicitado.

## 3. Diagnóstico da implementação atual

- `sampleElement` combina avanço quase uniforme, senoides e deslocamento
  procedural. Não armazena velocidade linear, torque ou velocidade angular.
- `breeze` deriva duas ondas de uma função de corrente, mas aplica o resultado
  como deslocamento. Não há arrasto em função da velocidade relativa ao ar.
- O giro aparente estreita a largura por `abs(cos(roll))`, com largura mínima
  de 20%. Não há orientação 3D, perspectiva real ou encontro correto com a borda.
- `petalSdf` desenha uma elipse com assimetria e um recorte. Não há afilamento
  botânico completo, nervação ramificada nem superfície em concha.
- A normal no fragment shader não deriva da superfície deformada nem acompanha
  uma rotação de objeto em 3D. O highlight pode mudar sem corresponder à forma.
- A linha central clara e o reflexo especular têm bastante peso. Minha leitura
  da imagem é um aspecto mais rígido/brilhante do que o desejado para pétalas.
- `depth` modifica tamanho/intensidade, mas não corresponde a posição Z e
  projeção: camadas aparentes ainda não são paralaxe de um espaço 3D.

## 4. Arquitetura candidata para a próxima iteração

### Forma e deformação

Criar poucas variantes controladas: base estreita, lâmina mais larga perto do
ápice, entalhe suave, assimetria e curvatura longitudinal/transversal. Uma malha
subdividida representa concha, ponta e torção. A deformação precisa atualizar a
normal pela mesma função (analiticamente ou por derivadas da superfície).
Rotacionar posição e normal pelo mesmo quaternion/matriz. Limitar a flexão à
escala que afeta a silhueta; o solver completo de tecido é uma hipótese posterior.

### Estado e forças

Guardar posição XYZ, velocidade, orientação e velocidade angular por identidade.
Amostragem de vento em espaço comum dá a velocidade relativa ar–pétala. Usar
gravidade, arrasto dependente da orientação e um torque reduzido com amortecimento.
A sustentação e o acoplamento angular devem ser aproximações calibradas
visualmente, sem chamar a implementação de reprodução do modelo JFM.

Alternar de forma gradual a tendência a deslizar, oscilar e girar, com parâmetros
por pétala. A mudança de inclinação deve alterar a deriva e a desaceleração;
não trocar orientação e trajetória por dois ruídos independentes. Para Senbonzakura,
adicionar uma força direcional artística comum, mantendo o detalhe aerodinâmico
local. A base natural e a direção sobrenatural não precisam disputar o controle.

Usar integração de passo fixo e interpolação de apresentação com limite de
subpassos. [Fix Your Timestep, Glenn Fiedler](https://gafferongames.com/post/fix_your_timestep/)
explica a separação entre simulação e render e o risco de uma recuperação de
tempo ilimitada. Não acumular segundos de aba oculta para simular ao retornar.

### Vento

Compor brisa média, envelope de rajada que viaja pelo conjunto e turbulência
espacial em poucas escalas. Partículas próximas compartilham a componente maior
da corrente; as diferenças vêm de posição, orientação, tamanho e inércia. O
ponteiro modifica um campo local com entrada/saída suaves, não a posição dos
corpos diretamente. Uma rajada deve acelerar o grupo antes de abrir a dispersão.

### Material e textura

Separar pigmento, microvariação, normal e espessura. Usar cor de base pálida com
gradientes delicados, nervuras ramificadas de baixo contraste, resposta especular
mais larga e fraca e contribuição de luz posterior tingida pela pétala. As duas
faces podem diferir. Alta opacidade não impede translucência iluminada: baixar
alpha indiscriminadamente só deixa o fundo aparecer.

Começar procedural; um pequeno atlas com poucas variações é alternativa caso
a silhueta/nervuras sofram com o custo de fragmento. Em ambos os casos, filtrar
os detalhes de acordo com o tamanho em pixels. Evitar veias e grão que cintilem.
Não adicionar textura de células microscópicas visível no tamanho de card.

### Camadas e transição

Poucas pétalas próximas tornam concha, entalhe e dobra legíveis; camadas médias
constroem o fluxo e as distantes reduzem tamanho e contraste. Z deve modificar
projeção e ordem de composição. Revisar alpha/oclusão antes de aplicar blur.
Depth of field deve ser opcional e contido: o custo de um passe de tela inteira
não é justificado antes de conferir a leitura sem ele.

Conservar ID, velocidade e orientação na passagem ao gelo. A transformação do
material/contorno deve acontecer sem reiniciar o corpo no segundo card. Resolver
isso junto da nova topologia é mais difícil do que trocar a cor: pode exigir
uma superfície comum deformável ou uma transição entre batches com pesos
complementares, validando sobreposição e custo.

## Critérios para o primeiro teste futuro

1. Uma pétala ampliada revela frente/verso, entalhe e concha; luz acompanha giro.
2. No tamanho real do card, a mesma forma continua reconhecível sem depender
   de brilho branco ou textura de alta frequência.
3. Uma rajada atravessa um pequeno grupo: há correlação espacial e atraso
   coerente da resposta. Pausas e eventuais giros não viram sincronismo de fases.
4. A troca de orientação altera o deslocamento; não há aceleração infinita,
   teleporte, estouro numérico ou salto após suspensão da aba.
5. A entrada/saída entre cards preserva a identidade e os controles HTML.
6. Medir CPU/GPU com captura ativa e revisar desktop/mobile/Safari antes de
   afirmar desempenho. Nenhum protótipo desse refinamento foi criado nesta etapa.
