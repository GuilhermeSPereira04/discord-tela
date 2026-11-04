# 🖥️ Discord Bot - Compartilhamento de Tela P2P

O comando `/tela` cria uma sala no navegador: a mensagem do canal leva o botão **Assistir**, e o botão **Transmitir** chega só para quem criou a sala. O vídeo vai direto de quem transmite para quem assiste (WebRTC/PeerJS); o bot roda num Cloudflare Worker, sem servidor ligado 24 h.

Veja [Publicar](#publicar) para colocar no ar.

## Desenvolvimento local da interface

Os estilos são gerenciados em `styles/src` com Sass modular. A compilação acontece automaticamente no `npm run dev`; `npm run styles:build` compila apenas os estilos e `npm run build` valida o pacote sem publicar. Veja a [direção visual, tokens, mixins e fontes da pesquisa](docs/design-system.md). Não edite `styles/generated/app.css`.

A tipografia atual é a Instrument Sans variável, servida localmente de `public/fonts`, com sua [licença OFL](public/fonts/OFL-Instrument-Sans.txt). A tela de espera do espectador usa duas esferas em branco e roxo neon, com faixa central nítida e difusão externa inspiradas na referência do Frontpush; o movimento respeita a preferência de movimento reduzido.

Tudo roda em `worker.js`: ele recebe as interações do Discord, assina os links das salas, atualiza a mensagem do `/tela` e serve a interface com PeerJS.

A [tela do transmissor](docs/host-screen.md) compartilha a identidade da espera e mostra as conexões reais como Espectador 01, 02 etc., sem inventar identidades do Discord. Ela oferece convite por link e indica se a captura inclui áudio.

A abertura do transmissor agora usa um [diorama ASCII compacto](docs/host-diorama.md), com tamanho responsivo de 416–608 px no desktop e até 448 px no layout empilhado abaixo de 64 rem, limitado à largura disponível. O render usa 768²/128×64 caracteres nas áreas maiores e 512²/96×48 nas menores. A cena roda em worker e para ao iniciar a seleção de captura. A espera do espectador conserva as esferas. O build gera os assets a partir de `effects/diorama`; `npm run client:build` compila estilos e animação, e `npm run styles:build` continua disponível para compilar apenas Sass.

Para desenvolver o front, use Node.js 22 ou superior:

```bash
npm ci
npm run dev
```

Abra os dois links com o mesmo identificador de sala:

- Transmitir: http://127.0.0.1:8787/?room=teste-local&mode=host&title=Sala%20de%20teste
- Assistir: http://127.0.0.1:8787/?room=teste-local&mode=view&title=Sala%20de%20teste

Para revisar o front sem uma transmissão, a tela local de espectador oferece os botões **Conectando** e **Conectado** (estado simulado). Também é possível abrir diretamente os estados com `&preview=waiting` ou `&preview=connected` no link de espectador. Essas prévias não abrem conexões PeerJS nem recebem mídia. O player simulado mantém os controles visíveis; **Miniatura** explica que precisa de vídeo real. Use **Sair da prévia** para voltar à conexão real.

A entrada por apelido é uma tela própria que ocupa toda a página. Espera, PeerJS e controles do player só são ativados depois de continuar; o apelido permanece opcional. No menu local, **Entrar com apelido opcional** usa `preview=nickname` para sempre mostrar essa tela durante os ajustes, inclusive após um apelido ter sido lembrado.

O fundo dessa entrada usa uma [multidão procedural em perspectiva](docs/nickname-crowd-study.md), como complemento visual da caminhada sob o vidro na tela de link expirado. A animação é decorativa, respeita movimento reduzido e é descartada ao entrar na transmissão.

Antes de publicar, rode `npm test`, `npm run build` e `npm run production:check`. O último comando executa o artefato do dry-run no runtime local da Cloudflare: verifica links assinados/expirados, autorização, ping do Discord, imports e assets estáticos. Usa somente chaves de teste e não publica nem envia mensagens. O CI executa essas mesmas etapas com Node 22. Isso não substitui testar captura/P2P entre aparelhos e redes reais nem conferir os segredos do Worker publicado.

Para abrir o menu local de revisão, execute `npm run preview` e acesse [Revisar as telas](http://127.0.0.1:8793/telas). Existe uma única tela **Transmitindo**, com os olhos neon aprovados, cinco participantes sintéticos e um controle para incluir áudio de teste. Preparação, entrada e estados do espectador continuam disponíveis. `npm run preview:check` confere as rotas e os assets com esse servidor ligado. Os mocks ficam em `scripts/preview.mjs`, fora da publicação. Na transmissão real, os olhos aparecem nas conexões reais, sem nomes ou espectadores inventados.

O player reserva espaço para controles de 48 px, adapta a barra para retrato/paisagem e mantém o botão de saída dentro da raiz em tela cheia. Veja [arquitetura, referências e limites da validação mobile](docs/player-responsive.md). `npm test` verifica a seleção das APIs de tela cheia; o teste visual de interrupção está documentado no mesmo arquivo.

Em tela cheia, clique/toque na imagem para ocultar a barra inferior e novamente para recuperá-la. Tab também recupera os controles. Voltar usa uma entrada temporária da própria sala para sair da tela cheia antes de navegar; sair pelo botão remove essa entrada. Veja [comportamento, testes e limites do mouse/celular](docs/player-immersive-controls.md).

Os controles têm transições de estado, volume personalizado com percentual durante o ajuste e revelação a partir da primeira imagem disponível. Veja a [correspondência de cada refino com Awwwards/Codrops, arquitetura e testes](docs/player-polish-references.md), incluindo o cenário local de mídia sintética.

O conjunto de áudio tem contornos animados por nível, marcador vertical com retorno suave e barra mais longa em celulares em retrato. Seus estilos ficam em `styles/src/components/_audio.scss`; a segunda passagem da documentação acima registra as referências e os testes específicos.

O botão de tela cheia recebe preenchimento direcional com inversão de cores e cinco partículas breves no clique. A [análise da gravação, referências e validação](docs/fullscreen-button-motion.md) explica como o efeito preserva o ícone, a área clicável e a solicitação nativa imediata.

O efeito agora é um [padrão reutilizável em Sass e JS](docs/button-motion.md), aplicado também às ações do transmissor. A [tela durante o compartilhamento](docs/host-live-design.md) ganhou margens, prévia proporcional, painel de participantes espaçado e entrada breve dos elementos.

A [abertura do diorama foi otimizada](docs/diorama-startup.md): preparação estática no build, recursos de cena menores e carregamento paralelo. A comparação local passou de 1,86 s para 0,53 s de mediana até o primeiro quadro pronto; tempos reais dependem do aparelho e da conexão.

Esse modo não precisa de token do Discord nem de login na Cloudflare. Clique em **Selecionar Tela ou Jogo** na página de transmissão e escolha o que compartilhar. Os links acima são apenas para teste local; outras pessoas não acessam o seu computador usando esse endereço.

O PeerJS ainda precisa de internet para sinalização. O código atual configura STUN, sem TURN, então a conexão entre certas redes pode falhar; nesse caso o espectador vê um aviso sugerindo outra rede (por exemplo, 4G/5G). Resolução, taxa de quadros e áudio dependem do navegador, da fonte capturada, do equipamento e da rede; 1080p/60fps é uma meta, não uma qualidade garantida. Para acesso remoto à captura, use HTTPS.

## Publicar

1. **Discord Developer Portal**
   - *General Information*: copie a **Public Key** para `DISCORD_PUBLIC_KEY` em `wrangler.toml`.
   - *Bot*: ligue **Public Bot** se outras pessoas puderem adicioná-lo.
   - *Installation → Guild Install*: escopos `applications.commands` e `bot`, com as permissões **View Channels**, **Send Messages** e **Embed Links** (valor `19456`). O bot publica a mensagem da sala no canal e depois a atualiza e apaga; sem ser membro, a sala funciona, mas a mensagem fica parada.
2. **Segredos do Worker** (o valor é pedido pelo terminal; nunca coloque no Git):
   ```bash
   npx wrangler secret put HOST_LINK_SECRET   # senha aleatória que assina os links das salas
   npx wrangler secret put DISCORD_TOKEN      # token do bot, para atualizar/apagar a mensagem
   ```
   Para gerar a senha: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (não cole a saída em lugar público).
3. **Publicar:** `npx wrangler deploy`. Copie o endereço mostrado para *General Information → Interactions Endpoint URL* e salve.
4. **Registrar o `/tela`** (uma vez): copie `.env.example` para `.env`, preencha `DISCORD_TOKEN` e `CLIENT_ID` e rode `npm run register`.

### Como as salas funcionam

- Os links valem por 24 h e são assinados: trocar `mode=view` por `mode=host` ou mexer no link faz ele ser recusado.
- Durante a transmissão, a mensagem mostra "Ao vivo" e quantas pessoas assistem. **Encerrar** apaga a mensagem; fechar a aba deixa "Transmissão encerrada".
- Quem transmite escolhe a prioridade da imagem (Nítida, Fluida ou Leve). O bitrate é dividido conforme o número de espectadores.
