require('dotenv').config();
const { REST, Routes } = require('discord.js');
const comandoTela = require('./comando-tela');

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ Preencha DISCORD_TOKEN e CLIENT_ID no arquivo .env antes de rodar!');
  process.exit(1);
}

// Registro global: o /tela aparece em qualquer servidor onde o bot for adicionado.
// Basta rodar uma vez (e de novo só se mudar o nome ou a descrição do comando).
new REST({ version: '10' })
  .setToken(DISCORD_TOKEN)
  .put(Routes.applicationCommands(CLIENT_ID), { body: [comandoTela] })
  .then(() => console.log('✅ Comando /tela registrado. Pode levar alguns minutos para aparecer.'))
  .catch((err) => {
    console.error('❌ Erro ao registrar comando:', err);
    process.exitCode = 1;
  });
