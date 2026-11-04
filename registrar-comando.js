require('dotenv').config();
const { REST, Routes } = require('discord.js');
const comandoTela = require('./comando-tela');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Preencha DISCORD_TOKEN, CLIENT_ID e GUILD_ID no arquivo .env antes de rodar!');
  process.exit(1);
}

new REST({ version: '10' })
  .setToken(DISCORD_TOKEN)
  .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [comandoTela] })
  .then(() => console.log('✅ Comando /tela registrado no seu servidor!'))
  .catch((err) => {
    console.error('❌ Erro ao registrar comando:', err);
    process.exitCode = 1;
  });
