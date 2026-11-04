// Copy the reusable source sections verbatim. No shader tuning or scene changes.
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await fs.readFile(new URL('upstream/templates/scene/main.js',root),'utf8');
const start = source.indexOf('// ---------- ascii + tilt shift ----------');
const end = source.indexOf('\nasync function main()',start);
const tagStart = source.indexOf('function tag(');
const tagEnd = source.indexOf('\nconst loadImg',tagStart);
const classes = source.match(/const CLS = (\{[^\n]+\});/);
const vertex = source.match(/const vtx = (`[^`]+`);/);
if(start<0 || end<0 || tagStart<0 || tagEnd<0 || !classes || !vertex) throw new Error('Upstream section markers changed; review manually.');
await fs.mkdir(new URL('extracted/',root),{recursive:true});
const notice = '// Extracted from JDhruv14/ascii-diorama 3d3278a0f925aebddc574dfb7042eb1eb815f427.\n// MIT, copyright 2026 JDhruv14. See ../LICENSE-upstream.txt.\n';
await fs.writeFile(new URL('extracted/ascii-passes.mjs',root),notice+"import * as THREE from 'three';\n\n"+source.slice(start,end)+`\nconst FULLSCREEN_VERTEX = ${vertex[1]};\nexport { GLYPHS, buildAtlas, asciiFrag, tiltFrag, FULLSCREEN_VERTEX };\n`);
await fs.writeFile(new URL('extracted/material-class.mjs',root),notice+`const SURFACE_CLASSES = ${classes[1]};\n`+source.slice(tagStart,tagEnd)+'\nexport { tag, SURFACE_CLASSES };\n');
console.log('Atlas, shaders, fullscreen vertex and material IDs extracted from inspected commit.');
