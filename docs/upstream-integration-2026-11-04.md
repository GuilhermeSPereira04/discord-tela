# Integração do repositório original — 04/11/2026

Foram incorporados os commits `8da80d1` e `de71950` de `origin/main`
(`GuilhermeSPereira04/discord-tela`) na branch local
`codex/atualiza-interface-webrtc`. O merge local é `aa22e34`.
Não houve push, publicação na Cloudflare ou registro de comando no Discord.

## Prioridade da integração

A lógica nova do autor foi priorizada: perfis Nítida/Fluida/Leve, limite de
bitrate por espectador, tentativa P2P de até 15 segundos, orientação sobre
possível bloqueio de rede, resposta privada adiada do comando e gerenciamento
da mensagem pública pelo bot.

Uma comparação das funções executáveis confirmou que as 14 funções de backend
do Worker, incluindo assinatura de links, criação da sala e atualização de
status, e o roteamento `worker.fetch` são idênticos a `origin/main`.
O cliente conserva os controles visuais, apelidos opcionais e proteções locais
para troca de fonte, reconexões e eventos de chamadas substituídas. Os limites
de qualidade e os prazos novos do autor prevalecem nesses caminhos.

Os conflitos foram resolvidos em `worker.js`, `_host.scss`, README e no exemplo
de ambiente. Na restauração das alterações locais também houve conflitos nos
testes, atualizados para o novo formato de links e o novo prazo de conexão.

## Ajuste necessário nas telas

O painel de participantes local só aparecia durante a transmissão. Isso
escondia as novas opções de qualidade antes da captura. Na abertura, o painel
agora apresenta somente essas opções: três colunas em desktop e uma em largura
compacta. Ao transmitir, a seleção acompanha o painel de participantes.

Foram preservados o diorama, controles de áudio e volume líquido, tela cheia,
miniatura, edição de apelido, olhos dos participantes e a página de link
expirado. Os arquivos locais sem sobreposição e todos os arquivos novos que
estavam no stash foram comparados com a cópia original e permanecem idênticos.
O lockfile também acompanha a exigência de Node >=22 introduzida pelo autor.

## Validação

- `npm test`: 85 testes passaram.
- `npm run build`: Sass, assets e pacote Worker passaram em dry-run.
- `git diff --check`: passou; não há arquivos com conflitos pendentes.
- `origin/main` é ancestral do HEAD local.
- Navegador Chromium: abertura e diorama, seleção persistente de qualidade,
  entrada com apelido, espera, player simulado, abertura do volume e
  entrada/saída da apresentação em tela cheia.
- Painel ao vivo com captura sintética: vídeo visível, seleção de qualidade
  durante o compartilhamento e retorno à abertura ao encerrar.
- Em larguras úteis de 375–390 e 1265 px não foi observado overflow horizontal
  nas telas verificadas; os controles medidos tinham 48 px de altura.
- Consoles consultados sem avisos ou erros.

A revisão móvel foi em viewport de desktop, sem validação de aparelho físico
ou Safari. Captura física, P2P entre redes distintas e envio real ao Discord
não foram executados. As chamadas Discord foram verificadas com mocks.

## Configuração e recuperação

O novo fluxo usa `DISCORD_TOKEN` como segredo do Worker para publicar,
atualizar e apagar a mensagem da sala. Sem ele, o autor fornece um modo reserva
que não atualiza nem apaga essa mensagem. O registro global é executado por
`npm run register`; o antigo bot Node e `npm start` foram removidos pelo autor.

A assinatura do link de host mudou para incluir canal, mensagem e autor.
Links de host do formato anterior deixam de ser aceitos por esta versão;
após publicar, uma nova chamada a `/tela` gera os links atuais.

As modificações locais das telas continuam sem commit, como antes da operação.
O stash `backup-local-antes-origin-main-2026-11-04` foi mantido e existe uma
cópia ZIP/patch em `artifacts/integracao-2026-11-04/`. Essa pasta contém também
o resultado da comparação de preservação e o servidor de QA sintético; ela
não faz parte de `public` ou do pacote publicado.
