# Validação para publicação — 04/11/2026

Base original consultada: `origin/main` em `de71950`. Esse commit é ancestral
da branch de entrega, que preserva os perfis de qualidade, limites de bitrate,
orientação de rede e fluxo de mensagens do Discord incorporados do autor.

## Resultado local

Uma cópia limpa dos 103 arquivos candidatos, sem `node_modules`, arquivos
gerados ou backups de `artifacts`, passou por:

- `npm ci`: instalação pelo lockfile, auditoria sem vulnerabilidades reportadas.
- `npm test`: 96 testes passaram.
- `npm run build`: Sass, assets do diorama e dry-run do Worker passaram.
- `npm run production:check`: artefato de `dist` executado pelo workerd,
  através do test harness do Wrangler e da configuração real de assets.

O teste de runtime usa hostname remoto, chaves descartáveis e nenhum token
real de Discord. Confere seis casos: host/espectador assinados, expiração,
acesso sem assinatura, troca indevida de papel e bloqueio da prévia simulada
no hostname remoto. Também valida convite gerado pelo host, assinatura do
ping Discord, recusa de assinatura ausente, recusa de status não autorizado,
sintaxe dos scripts e acesso a 22 assets/imports com resposta e MIME adequados.
Inclui os arquivos gerados apontados pelo manifesto do diorama e dependências
transitivas, como o volume líquido. Não há injeção do servidor de QA nessa execução.

A revisão encontrou que `preview=connected` podia habilitar a interface
simulada em um link remoto assinado. O estado agora exige hostname local,
com teste de regressão. Os links normais permanecem no fluxo de entrada real.

O CI foi ampliado para executar instalação, testes, build e teste de runtime
com Node 22 em Linux. A rodada local usou Windows e Node 24.11.1; o resultado
do CI deve ser consultado no PR para a validação independente em Linux/Node 22.

## Limites para a produção real

Não houve publicação. A Cloudflare não estava autenticada neste ambiente;
portanto `HOST_LINK_SECRET`, `DISCORD_TOKEN`, domínio e instalação/permissões
do bot no servidor publicado não foram inspecionados. Continuam necessários
os segredos e as permissões descritos no README. Os testes de criação/edição
de mensagem usam mocks; nenhum comando foi registrado ou mensagem real enviada.

Captura física, áudio de sistema, tela cheia/PiP em Safari e dispositivos reais,
FPS/GPU em celulares e WebRTC entre redes distintas não foram validados nesta
rodada. O acesso ao navegador local está desativado no Work. Os quadros WebGL
revisados anteriormente foram renderizados offline em GPU desktop; não são
prova do DOM ou do comportamento em aparelhos físicos.

O transporte existente usa STUN sem TURN. Restrições de NAT/firewall podem
impedir P2P; o aviso de rede do autor permanece. Isso não é resolvido pelo
build nem pelo teste local de runtime. Antes de considerar o deployment real
validado, é necessário fazer uma sessão host/espectador no HTTPS publicado,
incluindo entrada anônima/com apelido, troca de fonte, áudio e encerramento.
