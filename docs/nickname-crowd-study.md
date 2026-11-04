# Entrada de apelido: multidão em perspectiva

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
