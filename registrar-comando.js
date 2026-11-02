require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ALLOWED_GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !ALLOWED_GUILD_ID) {
  console.error('❌ Preencha DISCORD_TOKEN, CLIENT_ID e GUILD_ID no arquivo .env antes de rodar!');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('tela')
    .setDescription('Cria uma sala privada no navegador para compartilhar tela (1080p 60fps)')
    .addStringOption((opt) =>
      opt.setName('nome').setDescription('Nome opcional para a sala').setRequired(false)
    )
].map((cmd) => cmd.toJSON());

(async () => {
  try {
    console.log('⏳ Registrando o comando /tela no seu servidor privado...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, ALLOWED_GUILD_ID), {
      body: commands
    });
    console.log('✅ Comando /tela registrado com sucesso no seu servidor!');
  } catch (err) {
    console.error('❌ Erro ao registrar comando:', err);
  }
})();
