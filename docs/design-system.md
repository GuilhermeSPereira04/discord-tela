# Base visual e Sass

Direção definida em 03/11/2026: preto e branco e tipografia sem serifa. Versão atual da espera: Instrument Sans variável e duas esferas em branco e roxo neon atravessando uma faixa nítida, com difusão acima e abaixo, conforme referência enviada pelo usuário do Frontpush. Essa referência substitui o símbolo anterior de duas superfícies. O vermelho sangue permanece nos tokens anteriores para outros controles; não aparece na nova animação. A captura e a conexão WebRTC continuam com a mesma lógica.

## 1. Performance e viabilidade

Sass é uma dependência de desenvolvimento e compila antes do Worker. O navegador recebe CSS comum, incorporado ao HTML como antes, sem compilador ou rotina de dimensionamento por JavaScript. Não foram acrescentados efeitos WebGL ou bibliotecas de interface. O movimento atual se concentra nas esferas durante a espera e nos hovers dos controles. A entrada do conteúdo ocorre uma vez.

As superfícies gerais usam cores sólidas. A cena de espera é a exceção localizada: contém gradiente, halo e uma cópia desfocada, conforme a nova referência enviada. Não há desfoque aplicado à página inteira. Isso não representa medição de GPU ou prova de 60 fps. Captura, codificação, reprodução de vídeo e custo por espectador continuam precisando de testes próprios.

Usamos `100vh` como fallback de altura mínima e `100dvh` como aprimoramento, sem travar a rolagem. Em telas baixas, o conteúdo pode exigir rolagem vertical. A prioridade é manter texto e controles acessíveis. A compatibilidade foi conferida neste navegador Chromium; Safari, WebKit e aparelhos físicos não foram testados nesta etapa.

## 2. Fontes e interpretação

Consultadas em 03/11/2026:

- [Awwwards — Minimal](https://www.awwwards.com/websites/minimal/): acessado no navegador após falha de acesso pela ferramenta de pesquisa. A descrição editorial destaca equilíbrio, alinhamento e contraste, com remoção de elementos supérfluos. É uma referência de direção visual, não uma especificação de Sass, garantia de performance ou prova de premiação deste projeto.
- [Codrops — Techniques for Responsive Typography](https://tympanus.net/codrops/2013/11/19/techniques-for-responsive-typography/): texto de 2013, usado como referência histórica para legibilidade, comprimento de linha, contraste e ritmo. Os exemplos antigos de fontes não foram reproduzidos.
- [Codrops — Collective #784](https://tympanus.net/codrops/collective/collective-784/): publicação de 2023 que destaca escalas com `clamp()` e variáveis CSS e uma discussão sobre camadas de design systems.
- [Tobias Ahlin — Responsive type scales](https://tobiasahlin.com/blog/responsive-fluid-css-type-scales/): artigo original indicado pelo Codrops. Usamos o princípio de limites de escala; não copiamos a fórmula em pixels do artigo. As escalas locais combinam `rem` e `vw` para manter uma base relativa.
- [Sass — @use](https://sass-lang.com/documentation/at-rules/use/) e [depreciação de @import](https://sass-lang.com/documentation/breaking-changes/import/): base técnica atual para módulos com namespace, carregamento único e funções nativas em módulos `sass:`.
- [MDN — clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp) e [unidades de comprimento](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length): APIs utilizadas para tipografia e viewport.

Interpretação para esta interface: hierarquia vem de escala, peso, espaço e bordas, sem envolver cada estado em um cartão decorativo. O vermelho identifica ações e pequenos detalhes. Não é usado como cor de texto corrente sobre preto. Não há afirmação de que exista uma única estética ou arquitetura oficial do Awwwards.

## 3. Arquitetura

```text
styles/src/app.scss                 entrada
styles/src/abstracts/_tokens.scss    cores, fontes, pesos, entrelinhas, tamanhos, espaços
styles/src/abstracts/_mixins.scss    breakpoints, foco, alvo de toque, linhas e movimento reduzido
styles/src/_base.scss               reset e padrões globais
styles/src/components/_shell.scss   cabeçalho, títulos e estado de espera
styles/src/components/_connection.scss símbolo de espera, composição e movimento
styles/src/components/_controls.scss botões, vídeo e controles
styles/src/components/_preview.scss navegação de prévia e imagem simulada
styles/generated/app.css            saída gerada; não editar nem versionar
```

`wrangler.toml` executa `npm run styles:build` antes de iniciar ou empacotar. No desenvolvimento, observa `styles/src` e `worker.js`; a saída fica em outro diretório para não realimentar o observador. Incluir o Worker no observador evita que mudanças no template só apareçam depois de outro build Sass. O Worker importa o CSS como texto e o insere no HTML. O build não depende de um arquivo gerado já presente no Git. Arquivos de `public` são servidos como assets estáticos pela Cloudflare.

Padrões:

- `@use` com namespace; sem `@import` legado, globals Sass depreciados ou `transition: all`.
- Tokens CSS semânticos para componentes; mapas Sass para primitivas e breakpoints.
- Instrument Sans variável, pesos 400–700 e largura 75–100%, com fallback sem serifa. O título de espera usa peso 450 e largura 96%, sem animar os eixos. Tamanhos e espaços usam unidades relativas.
- Layout que quebra conforme o conteúdo, com um breakpoint compacto em 40rem. Títulos longos podem quebrar; não são cortados para caber.
- Controles em uma faixa no fluxo, visíveis por toque e teclado, sem dependência de hover.
- Foco visível, alvos com dimensão mínima de 2.75rem e regra de movimento reduzido.
- O espectador conserva a cena CSS de esferas. O transmissor usa um [diorama ASCII compacto](host-diorama.md) no mesmo espaço, preservando tipografia e tokens. A [tela do transmissor](host-screen.md) acrescenta presença e convite. As mensagens do bot no Discord mantêm sua apresentação anterior.

### Paleta inicial

| Papel | Valor |
| --- | --- |
| Fundo | `#080808` |
| Superfície | `#101010` |
| Texto | `#F5F5F2` |
| Texto secundário | `#ABABAB` |
| Borda | `#333333` |
| Vermelho sangue | `#990F18` |
| Vermelho em hover | `#B31520` |
| Texto sobre vermelho | `#FFFFFF` |

Contrastes calculados pela luminância relativa sRGB: branco sobre vermelho sangue 8.62:1; texto secundário sobre fundo 8.72:1; texto principal sobre fundo 18.34:1. São verificações desses pares de cores, não uma auditoria completa de acessibilidade.

## 4. Compilação e revisão

```bash
npm ci
npm run dev
npm run styles:build
npm run build
```

`npm run build` faz o empacotamento com `wrangler deploy --dry-run`: não publica o projeto.

Revisar os estados `preview=waiting`, `preview=connected` e o transmissor com título longo. As prévias não criam Peer nem capturam mídia. A qualidade da transmissão real não é validada por elas.

Validação desta etapa: Sass e empacotamento passaram. Medições DOM em 320×568, 390×844, 844×390 e 1440×900, nos três estados acima, não mostraram overflow horizontal nem botões visíveis menores que 44×44 CSS px. Telas baixas apresentaram rolagem vertical, sem bloqueio de acesso aos controles. Essas medições de viewport não substituem testes em dispositivos físicos.

## Revisão anterior: controles de prévia e indicador de conexão

O hover dos rótulos continua válido. O indicador em pontos descrito nesta seção foi substituído pelo símbolo da revisão abaixo.

Solicitação de 03/11/2026: retirar bordas e sublinhados dos três controles de prévia, adotar um hover sóbrio inspirado no Suho e animar a espera.

### Viabilidade

O hover usa dois rótulos empilhados em uma máscara de texto e transição de `transform`. O controle mantém sua área de clique e seu foco fora da máscara. Não há leitura de posição do ponteiro, novo loop JavaScript ou dependência de animação. O feedback de espera altera apenas a opacidade de três pontos e do indicador do cabeçalho; não altera a largura do texto. Esse desenho tem custo pequeno por construção, mas não foi feito benchmark de FPS ou de GPU em aparelho médio.

### Referências verificadas

- Checkout local do Suho: `C:/Projetos/Web/Suho_Portifa/src/features/site-chrome/components/home-interface.module.scss`, regras `.slotWindow`, `.slotGlyph` e `.menuList a:hover .slotGlyph`. A implementação local empilha glifos em janelas recortadas e desloca a coluna no hover/foco. A versão publicada em suho.studio não foi confirmada: o acesso pela ferramenta de pesquisa falhou. Não atribuir o estado do checkout automaticamente ao site publicado.
- [Codrops — Ideas for CSS Button Hover Animations](https://tympanus.net/codrops/2021/02/17/ideas-for-css-button-hover-animations/), de 17/02/2021: referência histórica de hovers em CSS. O artigo destaca o cuidado de não recortar o foco do botão ao aplicar clipping.
- [Código original do Codrops — ButtonHoverStyles](https://github.com/codrops/ButtonHoverStyles/blob/main/css/base.css): exemplos com deslocamento dos rótulos por `transform`, como os estilos Calypso e Skoll. Não foi copiada a composição visual desses botões.

### Decisões e arquitetura

Adaptação local: uma única rolagem vertical do rótulo completo, sem deformação, máscara no botão inteiro, efeito magnético, contorno ou sublinhado permanente. O estado selecionado usa texto claro e um ponto vermelho; os demais usam texto secundário. O link de saída recebe o mesmo movimento dos botões, mas mantém semântica de link.

O mixin `rolling-label` centraliza a transição. O hover exige ponteiro fino com hover disponível; teclado recebe o mesmo efeito por `:focus-visible`. A cópia decorativa de cada rótulo tem `aria-hidden="true"`, preservando um único nome acessível. O foco mantém contorno visível apenas na interação por teclado.

`setWaitingMessage()` cria o indicador visual e ativa `.is-connecting`. A chegada do stream real ou a entrada na prévia conectada remove a classe, interrompendo as animações. Uma desconexão volta ao estado de espera. Os pontos são decorativos e o texto de status usa uma região `polite`; não há anúncio por quadro, porcentagem inventada ou indicação de conexão real na prévia.

`prefers-reduced-motion` remove o deslocamento e as animações, mantendo rótulos, pontos estáticos e indicação do estado. A regra está implementada; não foi alterada a preferência do sistema operacional para este teste.

Validação: Sass compilou; controles mediram 44 px de altura, com borda zero, sem sombra e sem sublinhado. O navegador confirmou fases diferentes de opacidade durante a espera, o deslocamento do rótulo e foco visível pelo teclado, e `animation-name: none` nos pontos após entrar na prévia conectada. Medições de viewport entre 320 px e 1440 px, incluindo horizontal em 844×390, não mostraram overflow horizontal. A reprodução de vídeo real e o Safari continuam fora dessa validação visual.

## Revisão anterior: identidade do estado de conexão

A composição tipográfica desta revisão permanece. O símbolo em SVG foi substituído pela referência de vidro da revisão seguinte.

Pedido: abandonar o monitor em caixa, bolinhas, riscos e a tipografia padronizada da tela de espera. A composição e o símbolo foram tratados como uma única decisão visual.

### Performance e viabilidade

- Duas formas preenchidas em SVG de 160×128 unidades, com translação por CSS em ciclo de 3,2 s. Não há filtros, canvas, biblioteca adicional ou JavaScript executado a cada quadro. Transformações em SVG não garantem composição exclusiva na GPU; o custo precisa ser medido em dispositivos reais antes de qualquer afirmação de 60 fps.
- A animação só existe sob `.is-connecting`, para ao receber stream ou entrar na prévia conectada e pausa quando o documento fica oculto. Em movimento reduzido, as formas permanecem estáticas.
- A fonte variável local tem 57.332 bytes; é pré-carregada, usa `font-display: swap` e reúne os pesos em um único WOFF2 latino. Não há mais chamada ao Google Fonts no carregamento da interface. A licença OFL acompanha o arquivo em `public/fonts`.
- O novo layout mantém rolagem vertical quando necessária. Não houve teste em Safari ou aparelho físico nesta revisão.

### Referências de 2026 e limites da evidência

- [PP Neue Montreal — Awwwards](https://www.awwwards.com/sites/pp-neue-montreal): verificado no navegador como SOTD de 13/07/2026, com Developer Award. A [seleção de animações](https://www.awwwards.com/inspiration/pp-neue-montreal-interactions-pp-neue-montreal) foi aberta e inspecionada; o catálogo identifica fonte variável, layout e tipografia. Referência para o protagonismo da composição tipográfica. A fonte comercial do projeto não foi copiada ou instalada.
- [Goodgrowth — Awwwards](https://www.awwwards.com/sites/goodgrowth): verificado como Honorable Mention de 07/08/2026, sem atribuir SOTD. O catálogo destaca o [Spiral preloader](https://www.awwwards.com/inspiration/spiral-preloader-goodgrowth). A página do elemento foi acessada, mas sua reprodução mostrou um quadro vazio durante a captura; não foi feita análise quadro a quadro desse vídeo.
- [Goodgrowth — bastidores no Codrops, 27/08/2026](https://tympanus.net/codrops/2026/08/27/goodgrowth-boot-sequences-spinning-discs-and-the-art-of-the-portfolio/): o autor descreve continuidade entre abertura, identidade e transições, além de uma rotação CSS para o disco da entrada. Aplicação: um elemento de espera deve pertencer ao assunto do site, em vez de uma coleção de indicadores genéricos. A estética de console, espirais e disco não foi transplantada.
- [R—K ’26 — Codrops, 07/04/2026](https://tympanus.net/codrops/2026/04/07/r-k-26-the-thinking-and-code-behind-a-portfolio-led-by-presence/): o autor descreve a relação entre identidade, ritmo e estrutura e o papel do grid. Aplicação: escala, espaço e alinhamento compõem a tela; não se acrescentou a infraestrutura WebGL do caso.
- [Instrument Sans — Google Fonts](https://fonts.google.com/specimen/Instrument+Sans) e [licença no repositório oficial](https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt): origem e permissão de distribuição verificadas. A data do copyright é 2022; a escolha não é apresentada como uma fonte lançada em 2026. A General Sans foi examinada como alternativa, mas não integra o projeto.

Essas são referências específicas, não uma norma oficial de ícones do Awwwards nem prova de que o novo desenho receberia um prêmio.

### Proposta aplicada e arquitetura

O símbolo é original deste projeto: duas superfícies maciças, uma clara e uma vermelho sangue, se aproximam até delimitar uma abertura interna de 64×36 unidades (16:9). O ciclo permanece indeterminado; não indica porcentagem de conexão ou sucesso. Ele substitui os múltiplos pontos pulsantes, o monitor em caixa e seus acentos lineares na espera.

`CONNECTION_SYMBOL` define a geometria estática, `_connection.scss` define o movimento e o grid, e `.is-connecting` é ativada pela lógica existente de espera. A alteração de visibilidade do documento só pausa CSS; não cria relógio JavaScript. Os rótulos de prévia mantêm o hover anterior e usam contraste para indicar seleção, sem ponto, borda ou sublinhado.

A composição usa duas colunas no desktop (símbolo e texto) e empilhamento central no compacto. O título tem duas linhas intencionais, e o texto de apoio foi reduzido para explicar quando a imagem aparece. O template limpa o `display` inline ao reabrir o estado para permitir que o grid definido em Sass continue ativo.

### Validação da revisão

A fonte foi entregue localmente com HTTP 200, `Content-Type: font/woff2` e 57.332 bytes, e o navegador confirmou a família carregada. A espera foi medida em 320×568, 390×844, 844×390 e 1440×900, sem overflow horizontal nem botões menores que 44×44 CSS px. As prévias conectada e o transmissor com título longo também foram revisados nessas medidas; as leituras de viewport que inicialmente chegaram atrasadas foram conferidas nas dimensões efetivamente retornadas e complementadas no desktop. No conectado, as duas formas apresentaram `animation-name: none`.

Sass e empacotamento do Worker passaram em `npm run build` (dry-run, sem publicação). A inspeção final confirmou a fonte carregada, ausência dos antigos indicadores e console sem avisos ou erros nessa prévia. Não confundir essa validação com funcionamento de vídeo/áudio entre dispositivos.

## Revisão da espera: vidro e esferas do Frontpush

Pedido de 03/11/2026: substituir o símbolo por uma animação como a gravação fornecida e usar roxo neon no lugar do vermelho do símbolo anterior. A gravação enviada tem 5,37 s, 1038×892 e 30 fps. Foram extraídos quadros para analisar o movimento, sem modificar o original.

### 1. Performance e viabilidade

A nova cena tem custo maior que o SVG anterior: quatro elementos animados (duas cópias de cada esfera) e uma camada local com `filter: blur(12px)`. O filtro não cobre a página nem muda durante o ciclo. A área de efeito mede 224×224 CSS px no desktop e 192×192 no compacto. Apenas `transform` varia a cada quadro; posição de layout, tamanho, sombras e recorte ficam fixos.

Não há loop JavaScript, canvas ou nova dependência. O custo de rasterização/composição do filtro depende do navegador e da GPU; não foi medido em hardware médio ou Safari físico. O movimento pausa com documento oculto, para no conectado e é substituído por uma pose estática em movimento reduzido. O efeito não representa porcentagem ou avanço real da conexão.

### 2. Referência e evidência

- [Frontpush](https://frontpush.com.br/), [CSS público](https://frontpush.com.br/css/style.css) e estrutura HTML consultados em 03/11/2026. A referência está no bloco `.glass`, com `.ball-1` e `.ball-2`, e não no preloader `.screen-loading` do mesmo site.
- Na fonte consultada, `.glass::before` e `::after` ocupam 45% da altura cada e aplicam `backdrop-filter: blur(12px)`, deixando 10% nítidos no centro. O objeto claro tem sombras luminosas; o segundo usa gradiente azul. `move-ball` dura 5 s com `ease`, `alternate` e defasagem de 3 s no segundo objeto, alterando `top` e `left`.
- Na gravação, as esferas atravessam o corte horizontal e passam de formas nítidas a massas desfocadas. Isso foi observado nos quadros, sem inferir um shader ou uma implementação WebGL.
- [MDN — filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter) e [backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter): APIs utilizadas na análise. A implementação final usa `filter` em uma cópia da cena, não depende de amostrar o fundo da página.

### 3. Arquitetura aplicada

`CONNECTION_ORBS` define o par decorativo, e `CONNECTION_SYMBOL` o coloca em dois campos sincronizados. O campo difuso recebe blur fixo; o campo nítido usa `clip-path: inset(45% 0 45%)` e o mesmo fundo da página, cobrindo apenas a faixa central. Os dois campos têm as mesmas dimensões, trajetória e relógio CSS, evitando desalinhamento entre as cópias.

A primeira tentativa usou painéis com `backdrop-filter`, como a fonte, mas a inspeção visual não reproduziu a separação desejada nessa composição. Foi substituída pelo par de campos. Não foi determinada uma causa universal para o comportamento do backdrop-filter, nem se generalizou a observação para outros navegadores.

A trajetória equivale aos deslocamentos da referência, mas é implementada por `translate`: base em 30% horizontal/20% vertical; meio com deslocamento de 10%/30% da cena; fim com 30%/10%. Duração de 5 s, `ease` e `alternate`. A segunda esfera recebe atraso negativo de 3 s para começar já em outra fase, sem ficar parada no início da espera.

Paleta específica da animação: `#A855FF`, `#C887FF` e `#7022DE`, mais branco luminoso. Os tokens `connection-violet*` ficam no módulo de tokens. O layout e a tipografia anteriores foram preservados.

Refino posterior da esfera roxa: a tentativa com azul opaco na extremidade do gradiente produziu uma divisão de cor evidente e foi substituída por uma base radial inteiramente roxa. Azul `#5979FF` aparece somente em dois campos radiais amplos sobrepostos, dentro de uma camada com opacidade total limitada a 10%. Essa camada se desloca lentamente por `transform`, em 10 s com alternância, dando uma variação de textura sem criar uma região azul separada. As duas cópias da cena usam o mesmo movimento e fase. O halo externo é exclusivamente violeta; a esfera branca conserva preenchimento e brilho brancos puros.

O véu cromático usa um pseudo-elemento pequeno em cada cópia da esfera, recortado pelo círculo. Os gradientes não são animados. Não há biblioteca, textura de imagem, novo blur ou loop JavaScript; o custo de pintura/composição continua dependente do navegador, sem medição física de FPS. O movimento do véu só existe durante a conexão, pausa com a página oculta e respeita a regra global de movimento reduzido. Duração e opacidade ficam nos tokens `--duration-connection-tone` e `--connection-tone-opacity`.

### 4. Revisão

Conferidos visualmente o corte nítido e a difusão. As leituras DOM em 320×568, 390×844, 844×390 e 1440×900 não mostraram overflow horizontal; confirmaram `blur(12px)`, recorte de 45% acima/abaixo e transforms idênticos entre as cópias nítida e difusa de cada esfera. A prévia conectada removeu a classe de espera e apresentou `animation-name: none` nos quatro elementos. Sass e empacotamento passaram em `npm run build`, sem publicação. A preferência de movimento reduzido do sistema não foi alterada para testes nesta revisão.

Os arquivos públicos baixados apenas para análise e a prancha de quadros ficam em `artifacts/frontpush-research`, ignorados pelo Git; a implementação não incorpora JavaScript ou CSS completos do site externo.

## Revisão atual: player conectado

O player conectado mantém esta direção e passa a reservar espaço próprio para vídeo e controles, com alvo mínimo de 48 px e adaptação a retrato, paisagem e tela cheia. A causa reproduzida, a análise das APIs, a arquitetura de estados e os resultados estão em [player-responsive.md](player-responsive.md). O layout está em `_player.scss`, importado depois dos componentes anteriores; a espera e sua animação não foram redesenhadas nesta revisão.

O refino seguinte acrescenta resposta ao toque, ícones por estado, volume próprio, rótulo Miniatura e entrada da primeira imagem. Cada decisão está ligada a uma referência visual e uma fonte técnica em [player-polish-references.md](player-polish-references.md). Os tempos de 120/180/240 ms e a largura de tela cheia estão no módulo de tokens. Nenhum hover move a área clicável, e a animação da espera original permanece preservada.
