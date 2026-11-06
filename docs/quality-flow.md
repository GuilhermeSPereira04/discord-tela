# Fundos dos perfis de imagem — 05/11/2026

Registro do primeiro estudo. Substituído pelo [oceano ASCII](quality-ocean.md)
na preparação e na transmissão. `public/quality-flow.mjs` controla um único
renderer de oceano, preservado ao mover o fieldset entre as duas etapas.
Os efeitos de pétalas, gelo e chuva e seus testes exclusivos foram removidos
em 06/11/2026; os estudos correspondentes foram mantidos como histórico.
O shader de faixas descrito abaixo também não faz mais parte do runtime.

Protótipo local de faixas luminosas deformadas, inspirado na gravação de cards
enviada pelo usuário. Não há evidência do pipeline usado pelo autor da referência.
A reprodução usa ruído com domain warping, não uma simulação de fluido.

- `public/quality-flow.mjs`: um contexto WebGL2, um programa, até três desenhos
  por quadro, sem texturas, targets intermediários, bloom ou leituras de layout
  no loop de animação. O framebuffer é limitado a 180 mil pixels, DPR 1,25 e
  dimensão de 1536 pixels. Isso limita carga; não comprova FPS em um aparelho.
- Azul, violeta e verde recebem fases diferentes do mesmo campo procedural.
  Uma região protegida limita o brilho sob textos; o pico permanece na parte
  inferior. HTML mantém os textos, escolha única, teclado e foco.
- O próprio grupo acompanha o fieldset entre preparação e transmissão.
  O efeito pausa fora da tela, na aba oculta e durante a seleção de captura.
  Movimento reduzido, alto contraste ou erro de shader/contexto preservam fundos
  estáticos. Restauração de contexto e bfcache podem recriar os recursos.
- `_host.scss`: fundos estáticos e seleção por radio/borda, além da cor.
  Desktop usa cards de pelo menos 128 px; abaixo de 640 px, linhas de 80 px.

Base técnica: [domain warping e fBm](https://thebookofshaders.com/13/),
[campos deformados do Paper](https://shaders.paper.design/warp) e
[boas práticas WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
Não foi adicionada dependência dessas bibliotecas.

Validação: 106 testes Node e build Worker em dry-run passaram. Os cinco testes
do efeito cobrem limite de resolução, contexto compartilhado, ausência de layout
por quadro, pausa, preferências, falhas de compilação, perda/restauração de
contexto, bfcache e descarte. São verificações de ciclo de vida com GL simulado;
a compilação real foi observada no Chromium do preview.

No navegador, preparação em 1440 px usou um canvas de 512 × 128; transmissão
simulada, 640 × 128; viewport de 390 px, 336 × 256. Houve um único canvas para
os três perfis, sem overflow horizontal. Clique, setas e retorno ao parar foram
conferidos. Isso não valida a captura/transmissão entre aparelhos, Safari,
desempenho GPU ou cadência constante de 60 fps.
