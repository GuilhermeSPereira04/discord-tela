# Link expirado: caminhada sobre vidro fosco

Pesquisa e protótipo em 04/11/2026. O pedido autoriza uma experiência WebGL 2 mais presente nesta tela, mantendo somente a mensagem original centralizada. A cena substitui a aparência da rota existente; não cria outra opção de teste.

As seções iniciais registram o protótipo de três caminhantes. A versão atual com adultos, pares e crianças está descrita na ampliação ao final.

## 1. Performance e viabilidade

O renderer desenha seis instâncias de um quad, com uma única chamada `drawArraysInstanced`. Cada quad contém uma sola e os volumes desfocados de sua perna. Não existem modelos, texturas, uploads de vídeo, sombras em render target, raymarching ou pós-processamento de tela inteira. A cena representa projeção e profundidade de forma analítica; não é uma simulação física de vidro.

CPU: seis poses por frame, calculadas a partir de tempo decorrido. GPU: campos de distância, cobertura e detalhes locais nas áreas dos quads. Há limite de DPR 1,5 e orçamento de aproximadamente 1,5 milhão de pixels no buffer; 6 MB por superfície RGBA8 não incluem buffers extras ou custo do contexto. Pausa em aba oculta, fora da área visível e bfcache; movimento reduzido recebe um quadro estático. Sem WebGL, o aviso e o fundo permanecem.

É uma base plausível para uma página real com composição pequena, mas os testes não demonstram 60 fps em hardware médio/Safari/mobile. A compatibilidade e a fidelidade perceptiva exigem navegador e aparelho. O uso de um shader mais elaborado não torna seu custo irrelevante.

## 2. Referência e contexto

A referência direta é o vídeo enviado pelo usuário (`20261104-1856-07.9344942.mp4`, 874×554, aproximadamente 14 s). Foram inspecionados quadros em intervalos de 0,5 s e um quadro maior. O vídeo mostra uma página local, com “hi, i'm NUSRET” no centro. Não foi confirmado o autor, o código original ou uma premiação Awwwards dessa implementação.

Observado: fundo quase branco, solas escuras definidas, pernas/corpos difusos, pares em fases diferentes e circulação periférica em torno de conteúdo central. Isso difere de um efeito de pegadas persistentes: o pé e sua sombra se deslocam juntos, sem rastro no chão.

Fundamentos verificáveis:

- [MDN — drawArraysInstanced](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawArraysInstanced): múltiplas instâncias numa chamada WebGL 2.
- [The Book of Shaders — Shapes](https://thebookofshaders.com/07/): campos de distância para formas e bordas suaves. Usamos união de elipses/segmentos, recorte do arco e cobertura dependente da distância.
- [MDN — WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): orçamento de buffer, redução de chamadas e tratamento de perda de contexto.

O shader e a marcha deste projeto são uma reconstrução procedural da leitura visual do vídeo, sem atribuir ao autor o pipeline escolhido aqui. A referência não foi copiada como mídia de fundo.

## 3. Arquitetura

`invalidLinkPage()` continua respondendo HTTP 403, com o mesmo título e orientação: “Use /tela no Discord para criar uma nova sala.” A única importação JavaScript da página é o módulo decorativo `public/expired-walkers.mjs`. A validação de assinatura e o fluxo Discord não mudam.

`sampleExpiredWalkers()` calcula três trajetórias periféricas, seis pés e fases alternadas. O apoio compensa o avanço do corpo para manter o centro do pé parado; o balanço traz o pé para o próximo contato, elevando-o, encurtando sua projeção e suavizando sua borda. A troca de trajetória acontece fora do centro e recebe acomodação de opacidade nas extremidades.

O shader tem calcanhar, antepé, arco medial, borda de borracha e desenho discreto do solado. A perna combina volumes suaves com desfoque analítico crescente: partes mais próximas ficam definidas e partes afastadas do “vidro” ficam difusas. O blend do canvas usa composição premultiplicada adequada às seis instâncias sobrepostas.

O fundo claro acompanha a referência. A mensagem fica em HTML acima do canvas, com hierarquia tipográfica e sem moldura, navegação ou metadados. As trajetórias evitam o centro; um retângulo de exclusão suave medido a partir do aviso protege a leitura em telas estreitas e após carregamento da fonte. Canvas decorativo, `aria-hidden`, sem receber ponteiro. Dimensões e aviso são medidos apenas em resize, não a cada frame.

## 4. Verificação e limites

- Testes de marcha percorrem desktop/mobile e dois ciclos, verificando dados finitos, elevação/opacidade limitadas, alternância e apoio estacionário.
- Testes do renderer verificam uma chamada com seis instâncias, orçamento de pixels, ausência de leitura de layout por frame, pausa, quadro estático, ausência de WebGL, bfcache, restauração e descarte.
- O teste do Worker verifica mensagem original, importação decorativa, ausência de PeerJS/diálogo de apelido e preservação do status 403.
- `npm run build`, os 75 testes da suíte completa e `git diff --check` passaram nesta revisão.
- `.wrangler/render-expired-walkers.py` compila o GLSL real em OpenGL 3.3 desktop, adaptando apenas versão/precisão. Os quadros de desktop e mobile são inspeção do shader e da composição projetada, não screenshots de navegador ou evidência de compatibilidade WebGL no aparelho.

O acesso ao navegador local está desativado no Work nesta sessão. Layout DOM renderizado, marcha percebida em movimento real no navegador e desempenho/gestos em telefone continuam pendentes. Não se afirma equivalência exata ao vídeo, que pode usar modelos e técnicas diferentes.

## Refino de materiais e marcha

Revisão após o usuário observar pouca leitura de tecido, sola e independência das pernas.

### 1. Custo e viabilidade

A arquitetura continua com seis instâncias e uma chamada de desenho. Foram acrescentadas seis poses de joelho/quadril em uniforms e um material procedural mais elaborado. A região de cada quad cresceu cerca de 28% para acomodar a articulação; o custo por fragmento também aumentou devido à iluminação do solado. Manter draw calls e limite de buffer não significa manter o mesmo custo GPU. Não há textura, recurso externo, simulação de tecido, IK física ou pós-processamento novo.

Tramas pequenas são atenuadas por `fwidth`, reduzindo padrões que piscariam abaixo da resolução disponível. O detalhe se concentra na parte da perna mais próxima do vidro e perde definição com a profundidade. As pausas e o quadro estático para movimento reduzido continuam válidos. O resultado foi conferido pelo harness OpenGL desktop, sem certificação de FPS/mobile.

### 2. Pesquisa

- [Animation Mentor — Animating a Basic Human Walk Cycle](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/): contato, passagem, transferência de peso e aplicação da translação do corpo. A organização das fases orienta a experiência; os parâmetros específicos de tempo e distância são decisões artísticas locais.
- [Toon Boom — Walk Analysis](https://learn.toonboom.com/modules/walk-cycle-animation2/topic/walk-analysis): alternância de contato e passagem, com apoio de calcanhar/ponta.
- [The Book of Shaders — Fractal Brownian Motion](https://thebookofshaders.com/13/): combinação de frequências e limite de detalhes resolvíveis. A calça local combina dobras de baixa frequência e trama filtrada, sem importar uma biblioteca de ruído.
- [Khronos — GLSL 4.10, funções de derivada](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.10.pdf): derivadas e `fwidth` como estimativa de largura para filtragem de padrões procedurais. Os recursos empregados também existem no GLSL ES 3.00 do shader.

### 3. O que mudou

`walkerProfiles` define três combinações diferentes de cadência, duração do apoio, comprimento de passada, largura entre pés, elevação e abertura das pontas. A velocidade de cada trajetória deriva da passada/cadência para conservar apoio estacionário. O arco lateral ocorre somente no balanço e começa/termina suavemente. Uma interpolação cúbica com tangentes compatíveis com a translação do corpo elimina o salto de velocidade na saída e na chegada do passo.

O quadril recebe transferência lateral de peso e subida discreta; o joelho avança e abre na passagem. Esses pontos são calculados no espaço do corpo e convertidos para a referência de cada sapato, em vez de se arrastar uma mancha rígida junto do pé. A projeção do pé elevado encolhe ligeiramente, corrigindo o aumento de tamanho da versão anterior.

As pernas agora usam dois segmentos com largura progressiva, barra, costura lateral, dobras irregulares e trama, em tons contidos de denim, carvão e verde escuro. O solado tem três padrões: espinha de peixe, blocos separados e garras de trilha. Um campo de altura com gradiente local acrescenta luz nas cristas, sombra nos sulcos, borda de borracha e desgaste discreto. Não se trata de um modelo 3D fotogramétrico ou tecido fisicamente simulado.

### 4. Validação adicional

Os testes passam a verificar os joints finitos, perfis distintos, separação dos pés durante a passagem e velocidade próxima de zero na transição para/de apoio. O harness recebe os mesmos joints do módulo de produção e renderiza amostras sucessivas da marcha. Preservam-se a mensagem HTML, a exclusão central e o status HTTP 403.

Nesta passagem, a compilação, os 77 testes da suíte e `git diff --check` passaram. O shader compilou em OpenGL desktop e foram inspecionados oito quadros, incluindo a composição mobile e seis fases consecutivas da marcha. Isso não substitui reprodução em navegador nem medição em telefone.

## Ampliação do fluxo: adultos, pares e corrida

### 1. Viabilidade e custo

A capacidade do shader passa de seis para dezesseis pés. O desktop usa oito personagens (dois adultos sozinhos, dois pares e duas crianças); abaixo de 600 CSS px, usa seis (dois adultos, um par e duas crianças). Continua uma chamada de desenho, com quatro arrays de dezesseis `vec4` no vertex shader, dentro do mínimo de uniforms do WebGL 2. O orçamento do buffer e os mecanismos de pausa não mudam.

Mais instâncias aumentam o preenchimento e a sobreposição; não equivalem a custo constante. Os pés menores ocupam menos área e o segundo par não é desenhado no mobile. O blur continua analítico, sem passe de pós-processamento ou textura de tela inteira. Não há novo dado de desempenho físico ou garantia de 60 fps em celular.

### 2. Referência

[Adobe — Run Cycle Guide](https://www.adobe.com/uk/creativecloud/animation/discover/animation-run-cycle.html): na corrida, a saída do apoio acontece antes da chegada do outro pé e há suspensão. Essa diferença orientou os ciclos infantis, em vez de somente acelerar a caminhada adulta. A escala, a distribuição de personagens e os parâmetros específicos são decisões locais.

### 3. Arquitetura

`crowdActors` substitui a associação rígida de uma pessoa por trajetória. Aparência, escala, fase, tipo e grupo são independentes. Crianças usam pés/corpos menores, ciclos de 0,88 e 1,06 s e apoio inferior a metade do ciclo, permitindo suspensão dos dois pés. Joelhos e quadril acompanham o ritmo mais saltado.

Membros de um par compartilham trajetória, velocidade e offset lateral constante; cada membro mantém escala, cadência e material próprios. A leitura de “casal” vem de duas pessoas caminhando lado a lado, sem adicionar mãos ou corpos superiores que não aparecem nesta vista. Não há rótulos de personagens na página.

A sola recebe borda mais difusa já em apoio e perde ainda mais definição quando elevada. O contraste do relevo foi reduzido junto da borda para que os sulcos não pareçam recortados sobre uma silhueta desfocada. O aviso HTML e a exclusão central continuam intactos.

### 4. Verificação

Testes de todos os perfis confirmam dados finitos, capacidade fixa, quantidade responsiva, apoio estacionário e separação dos pés. Testes de grupo verificam velocidade/separação constantes; os de corrida verificam escala menor, ritmos distintos e intervalos com os dois pés elevados. O renderer é exercitado com 16 instâncias no desktop e 12 no mobile. O harness GPU usa os arrays e a contagem reais do módulo.

A compilação, os 80 testes e `git diff --check` passaram. Foram renderizados oito quadros em GPU desktop, incluindo a composição mobile e a sequência com pares/crianças. A prévia local entregou o módulo atualizado com HTTP 200 e preservou HTTP 403 na tela de link inválido. Reprodução no navegador e avaliação em aparelho físico permanecem pendentes.

## Separação nos cruzamentos

As rotas independentes podiam ocupar o mesmo espaço. O ajuste reserva horários de entrada para cada pessoa ou par, a partir de envelopes orientados que incluem passada, pés e pernas. Uma verificação contínua por eixos separadores calcula se esses envelopes se encontrariam durante a passagem. Pessoas aguardam fora do viewport e só entram com espaço reservado; não há deslocamento brusco ou empurrão de pé apoiado.

O plano é calculado e armazenado por dimensão de layout, com cache limitado a oito tamanhos. Casais mantêm a mesma reserva e velocidade, com um pouco mais de separação entre membros. Passagens rápidas adicionais aproveitam lacunas seguras, sem duplicar uma pessoa enquanto sua passagem anterior ainda está ativa. O ciclo local da marcha recomeça fora de vista; o cronograma completo repete sem criar conflitos novos após o primeiro ciclo. A densidade visível varia conforme essas entradas, mantendo o elenco e os tipos de personagens.

Não muda o shader ou a quantidade de chamadas de desenho. O custo adicional fica no planejamento de layout e na escolha do horário local de cada ator. Foram mantidos o apoio estacionário, a suspensão infantil e os materiais.

Um teste independente projeta cápsulas conservadoras das solas, incluindo blur, e das pernas próximas, e amostra um ciclo completo a 30 amostras/s em 320×568, 390×844, 844×390, 1440×900 e 3840×2160. Verifica sola/sola de qualquer personagem e sola/perna entre pessoas diferentes. O teste não compara somente centros dos personagens. A verificação contínua do planejador e essa amostragem geométrica não equivalem a uma inspeção pixel a pixel no navegador.

A compilação, os 81 testes e `git diff --check` passaram. O harness renderizou oito quadros com o novo cronograma; a prévia local confirmou a entrega do módulo atualizado.
