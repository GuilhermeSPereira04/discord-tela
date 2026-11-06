# Entrada de apelido: multidão em perspectiva

### Personagens e pesquisa de marcha — 05/11/2026

Sete variantes combinam corpos mais estreitos/largos, mulheres com rabo de
cavalo, cabelo curto ou coque e calça, túnica ou saia, além de duas variantes
infantis. Crianças têm escala menor, cabeça relativamente maior, pernas mais
curtas e ciclos próprios de caminhada. As amplitudes são direção artística,
não uma simulação clínica nem uma regra de marcha por gênero.

Dos 56 personagens, 9 são crianças e 23 têm apresentação feminina. Há quatro
casais dentro dessa população. Na versão estreita, são 28 personagens, incluindo
5 crianças, 13 mulheres e dois casais. São capacidades da cena, incluindo figuras
fora do viewport; não indicam espectadores conectados.

Cada casal ocupa duas células reservadas, com uma raiz, velocidade e distância
relativa comuns. As fases da marcha permanecem individuais. Uma recepção pausa
ambos para não separar o par, mas apenas o personagem escolhido muda de cor e
recebe o glitch. Isso mantém as pausas e a recuperação do espaçamento existentes.

A marcha ganhou transferência lateral pequena da pelve, absorção contida de
peso e atraso leve dos braços. O comprimento das pernas e o pé apoiado continuam
como restrições, inclusive com proporções infantis. O tronco preserva a estética
robótica; não foram importados clipes de captura de movimento.

Pesquisa aplicada:

- [Animation Mentor, tutorial de Jason Martinsen](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/):
  contato, absorção, passagem e subida, transferência de peso, braços com atraso
  e tradução linear do pé para evitar deslizamento. Adaptado em amplitudes baixas.
- [Kovar, Gleicher e Schreiner, Footskate Cleanup](https://graphics.cs.wisc.edu/Papers/2002/KSG02/cleanup.pdf):
  importância de preservar as restrições de apoio. O código usa IK analítica
  própria para duas articulações; não implementa o algoritmo de edição de mocap.
- [Moussaïd et al., PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0010047):
  organização lado a lado em grupos. Inspira a raiz e o espaçamento comuns dos
  casais, sem simular toda a dinâmica social descrita no artigo.

Anatomia e gestos acrescentam dois arrays de uniforms. Os lotes passaram a 28
figuras: nove arrays de 28 `vec4` + viewport somam 253 vetores no vertex shader.
Continuam dois desenhos no desktop e um na versão estreita, no mesmo contexto,
sem novas texturas ou passes. Layout e escolha das roupas ficam em cache entre
redimensionamentos. O shader real compilou no Chromium do preview; a validação
não estabelece 60 fps nem compatibilidade física com Safari ou celulares.

### Densidade e glitch — 05/11/2026

A população passou de 35 para 56 figuras no desktop e de 20 para 28 abaixo de
600 px. As figuras ficaram 25% maiores; sete faixas ocupam uma área superior
mais alta, com a mesma exclusão medida do formulário. Cada recepção tem três
pulsos separados, de 0,38/0,30/0,24 unidades do relógio local, em vez dos dois
pulsos de 0,18/0,14. O deslocamento das faixas passou de 0,065 para 0,24 unidades
da figura, com três cortes mais largos e pigmento nas regiões deslocadas.
Não há flash sobre a página; movimento reduzido continua sem sinais/glitch.

Os uniforms conservam capacidade de 35 figuras por lote. Desktop usa dois
desenhos instanciados (35 + 21), e a versão estreita usa um (28), compartilhando
um contexto e um programa. Isso aumenta a área desenhada e o trabalho de poses;
o limite de buffer permanece em 1,2 milhão de pixels. Os testes cobrem upload
dentro do lote, três pulsos distintos, marcha, pausas e espaçamento na mesma faixa.

### Revisão humanoide — 05/11/2026

As figuras agora têm ombros e cintura definidos, cabeça/colo separados,
cotovelos, antebraços, mãos e pernas afuniladas. O foco foi reduzido nas figuras
próximas para conservar a articulação, mantendo suavidade nas faixas distantes.
O tronco conserva um movimento rígido e o balanço dos braços continua contido.

`sampleNicknamePose` adapta os três perfis de apoio da tela de link expirado:
apoio de 60%, 66% e 58% do ciclo, elevação do pé em balanço, transição contínua
de velocidade e rotação de calcanhar/ponta. São figuras vistas de lado, portanto
altura e rotação foram adaptadas; a tela expirada e seu renderer não mudaram.
Dois segmentos de comprimento constante resolvem cada joelho. A altura comum
da pelve permite estender a perna de apoio sem uma postura agachada permanente.
Figuras pequenas aumentam a cadência quando necessário para acompanhar a faixa
sem esticar ossos ou deslizar o pé.

Pés, joelhos e rotação são calculados por figura na CPU e enviados em três novos
arrays de `vec4`. O desenho continua instanciado, numa chamada, com 35/20 figuras
e o mesmo limite de resolução. Sete arrays de 35 `vec4` e o viewport somam 246
vetores no vertex shader. O formulário e as sequências de recepção/pausa/cor
permanecem. Não foram adicionados modelos, texturas ou passes.

Novos testes verificam apoio sem deslizamento, velocidade contínua no contato,
perna oposta em apoio, orientação dos joelhos e comprimentos constantes de coxa
e canela em retrato, paisagem, desktop e QHD/4K. A pausa também congela a pose
real enviada ao shader, além da raiz e do relógio. O shader WebGL2 compilou no
Chromium do preview. Isso não comprova 60 fps, Safari ou telefone físico.

Protótipo de 04/11/2026, após a integração do repositório original. A entrada dedicada, o apelido opcional, o envio de perfil e o carregamento adiado de PeerJS/player foram preservados. A opção de revisão existente é usada; não se acrescenta outra tela ao índice.

## 1. Performance e viabilidade

O módulo `public/nickname-crowd.mjs` cria figuras procedurais em quads instanciados: 35 no desktop e 20 abaixo de 600 CSS px. Há uma chamada de desenho e quatro arrays de 35 `vec4`, dentro do mínimo de uniforms do vertex shader WebGL 2. O quarto array controla recepção de cor, deslocamento do glitch, repouso e paleta. Não acrescenta texturas, passes ou chamadas de desenho. Cada fragmento avalia uma figura em sua pequena área, não toda a multidão em cada pixel da tela. Não há modelos, texturas de pessoas, framebuffer de desfoque, reconhecimento de imagem ou cópia de vídeo.

O buffer é limitado a aproximadamente 1,2 milhão de pixels e DPR 1,5: cerca de 4,8 MB por superfície RGBA8, sem incluir buffers extras/compositor/contexto. CPU: projeções e parâmetros de marcha de até 35 figuras. GPU: segmentos, elipses, luz e cobertura suave por instância. O custo depende da área e sobreposição, não apenas da quantidade de draw calls. Não há medição de FPS ou prova de compatibilidade física em hardware médio/Safari/mobile nesta etapa.

A animação pausa em aba oculta ou fora de vista. Movimento reduzido recebe um quadro estático. O evento existente `viewerjoined` descarta programa, listeners e observers, encerrando o trabalho antes da transmissão. Quem já tem apelido salvo pula a entrada e não importa a cena. A resolução do import também confere se o usuário já continuou, evitando criar um renderer atrasado sobre o player.

## 2. Referência e contexto

A referência direta é a imagem fornecida pelo usuário: pessoas pequenas em um espaço claro, vista oblíqua, escalas diferentes e foco seletivo, com conteúdo em primeiro plano. O autor/site/código original não foi identificado; não se atribui uma premiação Awwwards ou técnica específica ao autor.

Fundamentos consultados:

- [The Book of Shaders — Shapes](https://thebookofshaders.com/07/): composição de campos de distância, elipses e segmentos com bordas suavizadas.
- [MDN — drawArraysInstanced](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawArraysInstanced): desenho de múltiplas instâncias numa chamada WebGL 2.
- [Codrops — CSS Glitch Effect](https://tympanus.net/codrops/2017/12/21/css-glitch-effect/), consultado em 04/11/2026: deslocamentos de pequenas faixas recortadas. Aqui o princípio é adaptado ao domínio do shader procedural, sem camadas de imagem e sem o flash de opacidade do exemplo original.

O resultado é uma reconstrução procedural em 2,5D. Não são modelos humanos fotogramétricos, uma simulação óptica completa ou uma representação de espectadores reais. Linhas, etiquetas e identidades da referência não entram na interface.

## 3. Arquitetura e composição

O link expirado olha as solas por baixo do vidro. A entrada mostra as pessoas de corpo inteiro em uma praça clara, como o outro lado dessa mesma situação visual. O formulário permanece HTML, com suas mensagens, rótulo, limite e opção de seguir sem apelido. O canvas é decorativo, `aria-hidden` e sem eventos de ponteiro.

Profundidade define escala, altura da projeção, foco e sombra de contato. Roupas, altura e fases variam. Cada faixa mantém velocidade e período de percurso comuns, com espaçamento inicial reservado; a variação individual não faz personagens da mesma faixa se ultrapassarem. O deslocamento de cada pé durante apoio compensa a velocidade da raiz.

A partir do segundo segundo, uma figura visível é selecionada por janela de nove segundos. Desacelera até uma postura de repouso, recebe dois pequenos deslocamentos horizontais de faixas e ganha pigmento azul mineral, vermelho rosado ou verde sálvia. A iluminação, as dobras e os gradientes permanecem no material. A cor se desfaz até o branco perolado neutro; a figura acelera suavemente para recuperar seu lugar original, sem acumular atraso. O atraso máximo ocupa um décimo da célula reservada da faixa. Em telas estreitas a sequência é encurtada para respeitar esse limite. A seleção fica presa à mesma pessoa durante toda a janela, sem saltar entre figuras.

O glitch altera geometria aparente em até cerca de dois CSS pixels, sem estrobo, variação brusca de opacidade ou efeito sobre o formulário. Movimento reduzido desativa pausas, cor e glitch, inclusive quando a preferência muda durante uma recepção. A sequência é decorativa: não recebe dados de pessoas reais e não indica conexão, mensagem ou estado da transmissão.

A multidão ocupa uma faixa superior e o formulário foi deslocado levemente para baixo. Uma área suave medida a partir do formulário atenua figuras próximas dos controles. O fundo e as cores claras ficam restritos à entrada: ao continuar, o player conserva seu tema existente; ao editar o apelido depois, o mesmo formulário continua usando o diálogo existente. A página pode rolar com pouco espaço ou teclado aberto. Scroll/resize atualizam a área protegida.

`worker.js` mantém o primeiro módulo do player aguardando `viewerjoined`. O fundo e o feedback já existente dos botões são carregados independentemente durante a entrada, sem iniciar o download de PeerJS ou anexar os controles de mídia antes da confirmação do usuário.

## 4. Verificação e limites

Testes verificam população/arrays finitos e determinísticos, espaçamento dentro das faixas durante quatro minutos (incluindo margem para o glitch), parada real dos relógios da raiz e da marcha, seleção estável de uma única pessoa, três paletas, retorno ao percurso sem atraso acumulado e desativação dos sinais em movimento reduzido. Também cobrem chamada instanciada, resolução limitada, ausência de medidas de layout por frame, pausa, WebGL indisponível, restauração e descarte ao entrar. O Worker é verificado quanto ao canvas decorativo, guard do import atrasado e manutenção do carregamento adiado. Os testes existentes de apelido lembrado, entrada sem nome, reconexão e edição continuam aplicáveis.

O harness local `.wrangler/render-nickname-crowd.py` compila o GLSL real em OpenGL desktop, adaptando versão/precisão, e gera quadros de desktop/mobile. O retângulo do formulário nesses quadros é estimado; não são screenshots do layout DOM. O posicionamento real do formulário, teclado e compatibilidade no navegador/aparelho precisam de verificação própria.

A compilação, os 95 testes da suíte e `git diff --check` passaram. A prévia respondeu nas seis rotas existentes e nos sete assets verificados; a resposta de `/nickname-crowd.mjs` contém o novo agendador e o uniform de sinais. Quadros das três paletas, do retorno neutro e da versão estreita foram compilados/renderizados na GPU desktop. O inventário de ferramentas confirmou que o acesso ao navegador local está desativado no Work; não houve validação visual do DOM nesta etapa.
