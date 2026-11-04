# 🖥️ Discord Bot - Compartilhamento de Tela P2P (VDO.Ninja)

## Desenvolvimento local da interface

Os estilos são gerenciados em `styles/src` com Sass modular. A compilação acontece automaticamente no `npm run dev`; `npm run styles:build` compila apenas os estilos e `npm run build` valida o pacote sem publicar. Veja a [direção visual, tokens, mixins e fontes da pesquisa](docs/design-system.md). Não edite `styles/generated/app.css`.

A tipografia atual é a Instrument Sans variável, servida localmente de `public/fonts`, com sua [licença OFL](public/fonts/OFL-Instrument-Sans.txt). A tela de espera do espectador usa duas esferas em branco e roxo neon, com faixa central nítida e difusão externa inspiradas na referência do Frontpush; o movimento respeita a preferência de movimento reduzido.

O repositório tem duas entradas diferentes: `index.js` inicia o bot Node e gera links do VDO.Ninja; `worker.js` recebe interações do Discord na Cloudflare e serve a interface própria com PeerJS. O comando `npm start` não abre essa interface.

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

O player reserva espaço para controles de 48 px, adapta a barra para retrato/paisagem e mantém o botão de saída dentro da raiz em tela cheia. Veja [arquitetura, referências e limites da validação mobile](docs/player-responsive.md). `npm test` verifica a seleção das APIs de tela cheia; o teste visual de interrupção está documentado no mesmo arquivo.

Em tela cheia, clique/toque na imagem para ocultar a barra inferior e novamente para recuperá-la. Tab também recupera os controles. Voltar usa uma entrada temporária da própria sala para sair da tela cheia antes de navegar; sair pelo botão remove essa entrada. Veja [comportamento, testes e limites do mouse/celular](docs/player-immersive-controls.md).

Os controles têm transições de estado, volume personalizado com percentual durante o ajuste e revelação a partir da primeira imagem disponível. Veja a [correspondência de cada refino com Awwwards/Codrops, arquitetura e testes](docs/player-polish-references.md), incluindo o cenário local de mídia sintética.

O conjunto de áudio tem contornos animados por nível, marcador vertical com retorno suave e barra mais longa em celulares em retrato. Seus estilos ficam em `styles/src/components/_audio.scss`; a segunda passagem da documentação acima registra as referências e os testes específicos.

O botão de tela cheia recebe preenchimento direcional com inversão de cores e cinco partículas breves no clique. A [análise da gravação, referências e validação](docs/fullscreen-button-motion.md) explica como o efeito preserva o ícone, a área clicável e a solicitação nativa imediata.

O efeito agora é um [padrão reutilizável em Sass e JS](docs/button-motion.md), aplicado também às ações do transmissor. A [tela durante o compartilhamento](docs/host-live-design.md) ganhou margens, prévia proporcional, painel de participantes espaçado e entrada breve dos elementos.

A [abertura do diorama foi otimizada](docs/diorama-startup.md): preparação estática no build, recursos de cena menores e carregamento paralelo. A comparação local passou de 1,86 s para 0,53 s de mediana até o primeiro quadro pronto; tempos reais dependem do aparelho e da conexão.

Esse modo não precisa de token do Discord nem de login na Cloudflare. Clique em **Selecionar Tela ou Jogo** na página de transmissão e escolha o que compartilhar. Os links acima são apenas para teste local; outras pessoas não acessam o seu computador usando esse endereço.

O PeerJS ainda precisa de internet para sinalização. O código atual configura STUN, sem TURN, então a conexão entre certas redes pode falhar. Resolução, taxa de quadros e áudio dependem do navegador, da fonte capturada, do equipamento e da rede; 1080p/60fps é uma meta, não uma qualidade garantida. Para acesso remoto à captura, use HTTPS.

Para ativar o bot Node, copie `.env.example` para `.env`, preencha suas credenciais localmente, registre o comando com `node registrar-comando.js` e execute `npm start`. O Worker usa outra configuração: endpoint de interações no Discord, `DISCORD_PUBLIC_KEY` da sua aplicação e o segredo `HOST_LINK_SECRET` (configure com `npx wrangler secret put HOST_LINK_SECRET`). O valor que veio em `wrangler.toml` pertence à configuração original e precisa ser substituído ao configurar sua aplicação. Não publique tokens no Git.

No Worker, os links de host e espectador têm assinaturas diferentes e expiram após 24 horas. O comando publica apenas **Assistir**; o link **Transmitir** é enviado em mensagem efêmera ao criador. O convite copiado na interface recebe a assinatura de espectador. A exceção sem assinatura existe apenas nos endereços locais de desenvolvimento. O bot Node mantém seu fluxo separado de links VDO.Ninja.

---

Bot privado para Discord que cria salas criptografadas sob demanda para transmissão de tela em **1080p/60fps com áudio estéreo** direto pelo navegador usando WebRTC P2P.

## 🚀 1. Configuração Inicial

1. Copie `.env.example` para `.env` e preencha:
   - `DISCORD_TOKEN`: Token gerado em **Discord Developer Portal > Bot > Reset Token**.
   - `CLIENT_ID`: ID da aplicação em **General Information > Application ID**.
   - `GUILD_ID`: ID do seu servidor no Discord (ative o *Modo Desenvolvedor* no Discord, clique com o botão direito no servidor e em **Copiar ID do servidor**).

2. Para testar localmente no seu PC:
   ```bash
   npm install
   npm start
   ```

---

## ☁️ 2. Como Hospedar na Nuvem (24/7)

O projeto já inclui os arquivos de configuração prontos para as principais plataformas:

### Opção A: Discloud ou Square Cloud (Mais fácil via `.zip`)
1. Edite o arquivo `.env` com suas chaves.
2. Compacte em um arquivo `.zip` **apenas** os arquivos:
   - `index.js`
   - `package.json`
   - `.env`
   - `discloud.config` (se usar Discloud) ou `squarecloud.app` (se usar Square Cloud)
   *(⚠️ Não inclua a pasta `node_modules` no `.zip`!)*
3. Faça o upload do `.zip` no painel da [Discloud](https://discloudbot.com/) ou da [Square Cloud](https://squarecloud.app/).

### Opção B: Render.com (Gratuito via GitHub)
1. Suba este repositório para um repositório privado no seu GitHub (sem o `.env`).
2. No Render, crie um **Web Service** ou **Background Worker** conectado ao repositório:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Em **Environment Variables**, adicione `DISCORD_TOKEN`, `CLIENT_ID` e `GUILD_ID`.
   *(O código em `index.js` já possui um servidor HTTP embutido que responde na variável `PORT` caso use Web Service).*

### Opção C: VPS Linux (Oracle Cloud / Google Cloud / AWS)
```bash
git clone <seu-repositorio>
cd discord-bot-tela
npm install
# Crie o arquivo .env com suas credenciais
npm install -g pm2
pm2 start index.js --name "bot-tela"
pm2 save
pm2 startup
```
