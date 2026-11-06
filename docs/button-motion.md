# Padrão de hover dos botões

O efeito da Tela cheia agora é um componente compartilhado: preenchimento da esquerda para a direita, saída pela direita e cópia decorativa do conteúdo com cor invertida. A mesma animação responde a foco de teclado; toque não mantém hover preso.

## Uso

```html
<button class="btn motion-button" type="button">
  <span class="button-motion-content">Minha ação</span>
</button>
```

```js
import { attachButtonMotion } from '/button-motion.mjs';

// Registre primeiro a ação real; a animação nunca adia captura/tela cheia.
button.addEventListener('click', executarAcao);
attachButtonMotion(button);
```

Na página do transmissor, basta acrescentar `data-button-motion`: o módulo de host inicializa esses elementos. `data-click-particles="true"` habilita as cinco partículas breves, como no CTA inicial. Ações de Trocar Tela, Encerrar e Copiar link usam somente preenchimento. Fora dessa página, chame o inicializador explicitamente.

O conteúdo pode ser envolvido automaticamente quando não há `.button-motion-content`, mas o span explícito facilita o layout desde o HTML inicial. O inicializador cria superfície e clone com `aria-hidden`, retira IDs duplicados e ignora inicializações repetidas do mesmo botão. O conteúdo principal continua sendo o único rótulo acessível.

## Sass

- `styles/src/abstracts/_button-motion.scss`: mixin `directional-fill`, responsável por recorte, inversão e decoração.
- `styles/src/components/_button-motion.scss`: classe `.motion-button` e integração com `.btn`.
- `public/button-motion.mjs`: estados de interação e partículas opcionais.
- `public/fullscreen-feedback.mjs`: adaptador dos nomes existentes no player; PiP continua com seu contorno próprio.

Use a classe junto ao componente de botão existente. Para um componente que precisa de um seletor próprio:

```scss
@use '../abstracts/button-motion' as motion;
.minha-acao { @include motion.directional-fill; }
```

`--button-motion-fill` e `--button-motion-ink` controlam o painel e seu texto. `--button-motion-padding` deve coincidir com o padding do botão; `--button-motion-inset` reserva a borda externa, quando houver. Na classe `.btn`, use `--button-motion-background`/`--button-motion-border` para customizar a base sem sobrescrever o fallback sem recorte.

## Custo e limites

Não há biblioteca nova, canvas ou loop JS por quadro. O hover anima `clip-path` de uma superfície pequena; isso pode exigir pintura/composição conforme o navegador. Não é garantia de 60 fps ou de trabalho exclusivo na GPU. Partículas, quando habilitadas, usam cinco spans fixos com opacidade/transform e são canceladas antes de novo clique. Movimento reduzido retira as transições e partículas. Sem suporte ao recorte, há troca simples de cor.

## Validação local de 03/11/2026

36 testes passaram, incluindo inicialização repetida, IDs, toque/foco/movimento reduzido, ação síncrona e os testes anteriores de captura/player/histórico. Sass e build Wrangler em dry-run passaram. No navegador: foco ativou o preenchimento de Encerrar com texto branco, copiar mostrou confirmação, Trocar Tela substituiu a mídia sintética, Encerrar limpou mídia/audiência e devolveu foco ao CTA. O player de espectador entrou e saiu do modo cheio, com um único rótulo e cinco partículas. A validação não abrange aparelhos físicos.
