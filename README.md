# 🖥️ Discord Bot - Compartilhamento de Tela P2P (VDO.Ninja)

Bot privado para Discord que cria salas criptografadas sob demanda para transmissão de tela em **1080p/60fps com áudio estéreo** direto pelo navegador usando WebRTC P2P.

## 🚀 1. Configuração Inicial

1. Abra o arquivo [`.env`](file:///C:/Users/gui/.gemini/antigravity/scratch/discord-bot-tela/.env) e preencha:
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
