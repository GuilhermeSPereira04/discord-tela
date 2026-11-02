require('dotenv').config();
const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags
} = require('discord.js');
const crypto = require('crypto');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ALLOWED_GUILD_ID =
  process.env.GUILD_ID && process.env.GUILD_ID !== 'id_do_seu_servidor_aqui'
    ? process.env.GUILD_ID
    : null;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Erro: Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot online como ${readyClient.user.tag}`);

  if (ALLOWED_GUILD_ID) {
    readyClient.guilds.cache.forEach(async (guild) => {
      if (guild.id !== ALLOWED_GUILD_ID) {
        console.log(`⚠️ Saindo de servidor não autorizado: ${guild.name} (${guild.id})`);
        await guild.leave().catch(() => {});
      }
    });
  } else {
    readyClient.guilds.cache.forEach((guild) => {
      console.log(`📌 Conectado ao servidor: ${guild.name} (ID: ${guild.id})`);
    });
  }

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const cmd = new SlashCommandBuilder()
      .setName('tela')
      .setDescription('Cria uma sala privada no navegador para compartilhar tela (1080p 60fps)')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome opcional para a sala').setRequired(false)
      )
      .toJSON();
    cmd.integration_types = [0, 1];
    cmd.contexts = [0, 1, 2];

    await rest.post(Routes.applicationCommands(CLIENT_ID), { body: cmd });
    console.log(`✅ Comando /tela ativo!`);
  } catch (error) {
    console.error('❌ Erro ao registrar comando /tela:', error);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  if (ALLOWED_GUILD_ID && guild.id !== ALLOWED_GUILD_ID) {
    console.log(`⚠️ Tentativa de adição em servidor não autorizado (${guild.name}). Saindo...`);
    await guild.leave().catch(() => {});
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (ALLOWED_GUILD_ID && interaction.guildId !== ALLOWED_GUILD_ID) {
    return interaction.reply({
      content: '🔒 Acesso restrito a um servidor privado.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'tela') {
    const customName = interaction.options.getString('nome') || 'Sala de Tela';
    const roomHash = crypto.randomBytes(6).toString('hex');
    const guildSuffix = (interaction.guildId || 'call').slice(-4);
    const roomId = `srv_${guildSuffix}_${roomHash}`;
    const password = crypto.randomBytes(4).toString('hex');

    // Links diretos WebRTC via VDO.Ninja (1080p, 60fps, áudio estéreo compartilhado)
    const hostUrl = `https://vdo.ninja/?room=${roomId}&password=${password}&screenshare&quality=0&framerate=60&stereo`;
    const viewUrl = `https://vdo.ninja/?room=${roomId}&password=${password}&scene`;

    const embed = new EmbedBuilder()
      .setTitle(`🖥️ ${customName}`)
      .setDescription(
        `Sala criada por ${interaction.user}!\n\n` +
        `1️⃣ **Quem vai transmitir:** clique em **Transmitir Tela**.\n` +
        `2️⃣ **Quem vai apenas assistir:** clique em **Assistir Transmissão**.`
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Transmissão P2P Criptografada (1080p/60fps) • Servidor Privado' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Transmitir Tela')
        .setStyle(ButtonStyle.Link)
        .setURL(hostUrl)
        .setEmoji('📡'),
      new ButtonBuilder()
        .setLabel('Assistir Transmissão')
        .setStyle(ButtonStyle.Link)
        .setURL(viewUrl)
        .setEmoji('👀')
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
});

if (process.env.PORT) {
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online!\n');
  }).listen(process.env.PORT, () => {
    console.log(`🌐 Healthcheck HTTP ativo na porta ${process.env.PORT}`);
  });
}

client.login(TOKEN);
