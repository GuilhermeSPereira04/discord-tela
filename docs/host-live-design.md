# Transmissor durante o compartilhamento

Revisão de 03/11/2026, aplicada ao estado `.host.player-active`. O alvo é acompanhar a própria imagem, ver quem está na sala, convidar, trocar a fonte e encerrar. A abertura com diorama e o player do espectador conservam seus layouts; o hover é um padrão compartilhado pedido pelo usuário.

## Direção e implementação

Os prints enviados mostravam vídeo colado às bordas, uma coluna de participantes separada por linha vertical e dois botões de tratamentos distintos. A revisão usa margens próprias, espaçamento entre prévia e participantes e uma prévia 16:9 com `object-fit: contain`, preservando fontes de outras proporções. A coluna mantém contagem, estados reais e aviso de identidade; nenhum nome ou participante é inventado pelo produto.

O título novo “Sua transmissão.” e a legenda “Prévia da tela” identificam a imagem local. O layout empilha abaixo de 64 rem e mantém as ações em alvos de 48 px. As linhas do grid ficam alinhadas ao início para que a altura da janela não gere um vão artificial entre vídeo e participantes. As margens e a hierarquia usam Instrument Sans, paleta e escala de espaçamento existentes.

Trocar Tela, Encerrar e Copiar link usam o [padrão de hover](button-motion.md). Encerrar conserva o papel vermelho no preenchimento, com uma base mais discreta. A entrada da imagem e do painel é breve, com opacidade e deslocamento de 8 px; não se repete ao trocar a fonte e é removida por movimento reduzido. O diorama continua encerrado durante captura, sem contexto WebGL decorativo competindo com o compartilhamento.

Na primeira entrada, o foco vai ao título e a página retorna ao topo. Trocar a fonte preserva a posição. Ao encerrar, o foco retorna a Selecionar tela. As funções de captura, compartilhamento, audiência e cópia continuam sendo os handlers originais.

## Referência e evidência

A base foi o material do usuário e o hover anteriormente implementado para a Tela cheia. A consulta opcional ao Mobbin foi recusada por exigir plano pago; nenhum precedente de Mobbin foi usado ou atribuído. “Premium/quase Awwwards” é a direção pedida pelo usuário, não uma avaliação de prêmio.

## Conferência

- 36 testes e build em dry-run aprovados; sem publicação.
- Interface real compilada de `worker.js`, servida atualmente por `scripts/preview.mjs` (`npm run preview`). O servidor antigo em `.wrangler` foi substituído na consolidação de 04/11/2026. Somente a URL de QA injeta vídeo gerado por canvas e um transporte sintético; esses dados não entram no HTML de produção.
- Trocar Tela, copiar convite, adicionar participantes sintéticos, encerrar e retornar ao CTA verificados no navegador. O teste não capturou a tela real do usuário nem comprovou uma chamada WebRTC entre dispositivos nesta revisão.
- Larguras de 320, 390, 768, 1024 e 1440 px, em iframes de teste: sem overflow horizontal, ações com 48 px de altura, prévia proporcional e painel empilhado nas larguras menores. Não é teste em telefone físico.
- Nenhum ID duplicado após a decoração dos botões. Estado ao encerrar: sem stream no vídeo, contador zero, foco no CTA e abertura restaurada. Console do cenário de teste sem erros/avisos.
- Tela cheia do espectador entrou/saiu no navegador integrado após o compartilhamento do componente. APIs nativas de Safari/iOS e desempenho sustentado continuam fora desta conferência.
