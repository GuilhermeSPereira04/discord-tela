# Partes separadas

Estes arquivos preservam as seções originais do commit `3d3278a`. Não são ainda um componente pronto para montar na interface.

- `ascii-passes.mjs`: atlas de caracteres, seleção/coloração ASCII, blur tilt-shift e vertex shader do quad. Exporta `GLYPHS`, `buildAtlas`, `asciiFrag`, `tiltFrag`, `FULLSCREEN_VERTEX`.
- `material-class.mjs`: `SURFACE_CLASSES` e `tag(material, classId, extra?)`, para gravar a classe no canal alfa do render da cena.
- `../reference/main.js`: animação completa e inalterada, incluindo cenário, câmera, vento, mar e raposa.

## Contratos do efeito

1. Contexto WebGL 2 e shaders GLSL 3; texturas float/half-float e seus filtros precisam de suporte.
2. A textura de cena guarda cor em RGB e ID de material em A. O alfa não é transparência comum. `tag` grava `classId / 16`; o shader o recupera por amostragem sem interpolar classes.
3. O passe ASCII recebe `uScene`, `uAtlas`, `uGrid`, `uTime`, `uN`. A textura da cena precisa de mipmaps, usados na média da área de cada célula.
4. O atlas usa `textureGrad` e derivadas contínuas da grade. Trocar por derivadas do UV descontínuo do atlas pode criar falhas nas bordas das células.
5. O tilt-shift recebe `uA` e `uRes`; a constante original de blur está em pixels de render. Ajustar resolução sem rever esse contrato muda o efeito.
6. A grade e a proporção dos caracteres foram calibradas para canvas quadrado. Os IDs e os caracteres usados nas regras precisam existir no atlas.
7. A cena original controla `document.body`, cria um canvas global e instala um loop sem descarte. Esses trechos não devem entrar como estão no Worker.

Regenerar apenas a extração: `npm run extract` na pasta de estudo. Atlas e shaders importam com Three.js local, mas construir um renderer exigirá montar os render targets e o quad conforme o pipeline original.
