const { SlashCommandBuilder } = require('discord.js');

// Definição única do /tela, usada pelo bot e pelo script de registro.
module.exports = new SlashCommandBuilder()
  .setName('tela')
  .setDescription('Cria uma sala privada no navegador para compartilhar tela (1080p 60fps)')
  .addStringOption((opt) =>
    opt.setName('nome').setDescription('Nome opcional para a sala').setMaxLength(100).setRequired(false)
  )
  .toJSON();
