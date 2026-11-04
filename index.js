require('dotenv').config();
const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const crypto = require('crypto');
const http = require('http');

const { DISCORD_TOKEN: TOKEN, PORT } = process.env;
const ALLOWED_GUILD_ID =
  process.env.GUILD_ID && process.env.GUILD_ID !== 'id_do_seu_servidor_aqui' ? process.env.GUILD_ID : null;

if (!TOKEN) {
  console.error('❌ Erro: defina DISCORD_TOKEN no arquivo .env.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function leaveIfUnauthorized(guild) {
  if (!ALLOWED_GUILD_ID || guild.id === ALLOWED_GUILD_ID) return;
  console.log(`⚠️ Saindo de servidor não autorizado: ${guild.name} (${guild.id})`);
  await guild.leave().catch((err) => console.error(`Falha ao sair de ${guild.id}:`, err.message));
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot online como ${readyClient.user.tag}`);
  await Promise.all(readyClient.guilds.cache.map(leaveIfUnauthorized));
  if (!ALLOWED_GUILD_ID) console.log(`📌 Servidores: ${readyClient.guilds.cache.map((g) => g.name).join(', ')}`);
});

client.on(Events.GuildCreate, leaveIfUnauthorized);

function createRoomReply(interaction) {
  const customName = interaction.options.getString('nome') || 'Sala de Tela';
  const roomId = `srv_${(interaction.guildId || 'call').slice(-4)}_${crypto.randomBytes(6).toString('hex')}`;
  const password = crypto.randomBytes(4).toString('hex');
  const base = `https://vdo.ninja/?room=${roomId}&password=${password}`;

  const embed = new EmbedBuilder()
    .setTitle(`🖥️ ${customName}`)
    .setDescription(
      `Sala criada por ${interaction.user}!\n\n` +
      `1️⃣ **Quem vai transmitir:** clique em **Transmitir Tela**.\n` +
      `2️⃣ **Quem vai apenas assistir:** clique em **Assistir Transmissão**.`
    )
    .setColor(0x5865f2)
    .setFooter({ text: 'Transmissão P2P Criptografada (1080p/60fps) • Servidor Privado' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Transmitir Tela').setStyle(ButtonStyle.Link)
      .setURL(`${base}&screenshare&quality=0&framerate=60&stereo`).setEmoji('📡'),
    new ButtonBuilder().setLabel('Assistir Transmissão').setStyle(ButtonStyle.Link)
      .setURL(`${base}&scene`).setEmoji('👀')
  );

  return { embeds: [embed], components: [row] };
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'tela') return;
  try {
    if (ALLOWED_GUILD_ID && interaction.guildId !== ALLOWED_GUILD_ID) {
      await interaction.reply({ content: '🔒 Acesso restrito a um servidor privado.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(createRoomReply(interaction));
  } catch (err) {
    console.error('❌ Erro ao responder /tela:', err);
  }
});

if (PORT) {
  http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online!\n');
  }).listen(PORT, () => console.log(`🌐 Healthcheck HTTP ativo na porta ${PORT}`));
}

client.login(TOKEN);
