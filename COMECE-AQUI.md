# Comece por aqui

Este pacote contém o código atualizado da interface de compartilhar/assistir,
incluindo o Sass, o hover reutilizável, o diorama otimizado, assets/fontes com
licenças, scripts de build e testes. Os arquivos gerados são recriados pelo build.

## Rodar a interface

Use Node.js 22 ou superior e npm.
Extraia o ZIP e abra o terminal dentro da pasta bot-discord-front-atualizado:

```bash
npm ci
npm run dev
```

Depois abra:

- Transmitir: http://127.0.0.1:8787/?room=teste-local&mode=host&title=Sala%20de%20teste
- Assistir: http://127.0.0.1:8787/?room=teste-local&mode=view&title=Sala%20de%20teste

Esses endereços são locais. Para outra pessoa acessar pela internet, publique o
Worker e use os links HTTPS do domínio publicado. O PeerJS usa internet para a
sinalização das conexões, mesmo durante o teste local.

## Conferir antes de publicar

```bash
npm test
npm run build
```

`npm run build` faz o build/dry-run; não publica. Para publicar na Cloudflare,
use a conta/configuração do responsável pelo projeto e `npx wrangler deploy`.
Confira o nome do Worker e a chave pública em wrangler.toml se usar outra
aplicação do Discord; mantenha a configuração original se continuar usando a mesma.

## Entradas do projeto

- worker.js: interface com PeerJS e interações do Discord na Cloudflare.
- registrar-comando.js (`npm run register`): registra o /tela uma vez.

O front local funciona sem .env ou token do Discord. Para publicar, siga a
seção "Publicar" do README.

## Alterar o front

- styles/src: Sass modular; não editar o CSS gerado.
- public/*.mjs: controles e comportamento do player/interface.
- effects/diorama: animação, dados/fontes originais e licenças.
- scripts/build-diorama.mjs: prepara os dados estáticos e assets menores.
- docs/button-motion.md: como reutilizar o hover com .motion-button.
- docs/diorama-startup.md: medições e arquitetura da abertura otimizada.

Não acompanham este ZIP: credenciais, node_modules, histórico Git, caches,
servidores de QA, capturas pessoais, nem a pasta de pesquisa usada na exploração.
Os links a research/ em alguns documentos são referências da pesquisa original;
essa pasta não é necessária para rodar ou compilar o projeto.
