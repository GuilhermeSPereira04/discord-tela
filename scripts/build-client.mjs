import { compile } from 'sass';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildDiorama } from './build-diorama.mjs';
await mkdir('styles/generated', { recursive: true });
await writeFile('styles/generated/app.css', compile('styles/src/app.scss', { style: 'compressed', sourceMap: false }).css);
await buildDiorama();
