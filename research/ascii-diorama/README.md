# ASCII Diorama — estudo separado

Origem: [JDhruv14/ascii-diorama](https://github.com/JDhruv14/ascii-diorama), commit `3d3278a0f925aebddc574dfb7042eb1eb815f427`, de 02/11/2026. Análise em 03/11/2026.

Este diretório não é importado pelo Worker e não está em `public`. A integração posterior usa uma cópia adaptada em `effects/diorama`, documentada em [host-diorama.md](../../docs/host-diorama.md). Esta pasta preserva o estudo e a referência intacta.

## Organização

| Caminho | Conteúdo |
| --- | --- |
| `upstream/` | Clone original, sem modificações; ignorado pelo Git do bot |
| `reference/main.js` | Cena completa, cópia idêntica ao original |
| `reference/assets/` | Seis texturas e Fox.glb das fontes oficiais |
| `extracted/` | Atlas, passes ASCII/tilt-shift, quad vertex e IDs de materiais |
| `scripts/` | Downloads verificáveis, extração e instrumentação isolada |
| `asset-manifest.json` | URLs, licenças, tamanhos e SHA-256 dos assets |
| `baseline-summary.json` | Resumo da medição desktop |
| `artifacts/` | Medição detalhada local; ignorada pelo Git |
| `ANALYSIS.md` | Viabilidade, referências, arquitetura e plano de integração |
| `ATTRIBUTION.md` | Créditos e licenças a preservar |

Dependências próprias: Three.js `0.187.0` e esbuild `0.28.2`, com lockfile. Nenhuma dependência foi acrescentada ao pacote do bot. O upstream não fixa uma versão do Three.js; esta é a versão verificada no estudo e apresenta o aviso de compatibilidade documentado na análise.

## Abrir a cena original

No PowerShell, a partir da raiz do bot:

```powershell
Set-Location research/ascii-diorama
npm ci --ignore-scripts --no-audit --no-fund
npm run assets
npm run preview
```

Abrir [http://127.0.0.1:5174/](http://127.0.0.1:5174/). O servidor compila a cena ao recarregar. Espaço congela o tempo da simulação, mas o código original continua renderizando; feche a aba para encerrar o contexto.

Se o clone ignorado não existir ao copiar o estudo para outra máquina, executar dentro desta pasta:

```powershell
git clone https://github.com/JDhruv14/ascii-diorama.git upstream
git -C upstream checkout 3d3278a0f925aebddc574dfb7042eb1eb815f427
```

## Repetir a medição

```powershell
npm run diagnostics
npm run preview
```

Abrir [http://127.0.0.1:5174/diagnostic.html](http://127.0.0.1:5174/diagnostic.html), mantendo apenas uma cena aberta. A instrumentação conserva resolução, objetos, shaders e luzes; coleta estatísticas do renderer e queries de GPU assíncronas quando disponíveis. Ela não comprova desempenho de celular ou captura simultânea.

`npm run extract` regenera somente os módulos separados a partir do clone inspecionado. Os shaders são peças para a futura adaptação; ainda não há componente de produção com mount/dispose.
