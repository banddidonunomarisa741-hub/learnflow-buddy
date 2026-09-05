import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuses the maintained vector mascot; requires Sharp only for raster export.
// Set LEARNFLOW_SHARP_MODULE to an installed Sharp module path when needed.
const require = createRequire(import.meta.url);
const sharp = require(process.env.LEARNFLOW_SHARP_MODULE || 'sharp');
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
const cat = (await readFile(path.join(assets, 'buddy-cat.svg'), 'utf8')).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

for (const mode of ['day', 'night']) {
  const night = mode === 'night';
  const c = night
    ? { base: '#182335', glow: '#BD692E', stroke: '#C99B65', subtle: '#526074', paper: '#293A4E', ink: '#152135', mask: '#101B2D' }
    : { base: '#FFF3E4', glow: '#FFD07A', stroke: '#DFAA61', subtle: '#EBD4AF', paper: '#FFFBF4', ink: '#EDD3A6', mask: '#FFF8EF' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="910" viewBox="0 0 1000 910" role="img" aria-label="LearnFlow 精选场景${night ? '夜间' : '日间'}背景">
<defs>
  <radialGradient id="base-glow"><stop stop-color="${c.glow}" stop-opacity="${night ? '.34' : '.70'}"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
  <linearGradient id="overlay-left" x1="0" x2="1"><stop stop-color="${c.mask}" stop-opacity=".94"/><stop offset=".48" stop-color="${c.mask}" stop-opacity=".42"/><stop offset="1" stop-color="${c.mask}" stop-opacity="0"/></linearGradient>
  <linearGradient id="overlay-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${c.mask}" stop-opacity=".60"/><stop offset=".55" stop-color="${c.mask}" stop-opacity="0"/></linearGradient>
  <linearGradient id="overlay-bottom" x1="0" y1="1" x2="0" y2="0"><stop stop-color="${c.mask}" stop-opacity=".86"/><stop offset=".35" stop-color="${c.mask}" stop-opacity=".12"/><stop offset=".66" stop-color="${c.mask}" stop-opacity="0"/></linearGradient>
</defs>
<g id="base-illustration">
  <rect width="1000" height="910" fill="${c.base}"/>
  <ellipse cx="767" cy="490" rx="490" ry="470" fill="url(#base-glow)"/>
  <g fill="none" stroke="${c.subtle}" stroke-width="1.6">
    <circle cx="748" cy="462" r="320"/><circle cx="748" cy="462" r="255" stroke-dasharray="4 13"/>
    <path d="M454 712H936M502 742H950M568 771H922"/>
    <path d="m563 228 13-19 22 2m286 460 22-3 14-15M471 508l-19 21 6 17"/>
  </g>
  <g transform="translate(590 300) rotate(9 158 158) scale(2.3)">${cat}</g>
  <g fill="${c.paper}" stroke="${c.stroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M461 584q65-23 127 13v111q-63-35-127-12Zm127 13q64-34 130-15v112q-65-16-130 14Z"/>
    <path d="M475 708q52-17 111 11l7 0q51-26 111-14" fill="none"/>
    <path d="M482 609q40-7 78 11m-78 13q40-7 78 11m-78 13q30-5 60 5m48-54q39-18 78-12m-78 36q39-18 78-12m-78 36q26-12 50-13" fill="none" opacity=".72"/>
  </g>
  <g transform="translate(770 685) rotate(-11)" fill="${c.paper}" stroke="${c.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect width="141" height="25" rx="7"/><path d="M9 31h126q8 0 8 8v12H10q-9 0-9-10t8-10Z"/>
    <path d="M21 10h99M21 41h105" opacity=".52"/>
  </g>
  <g fill="none" stroke="${c.stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M818 224h82q12 0 12 12v49q0 12-12 12h-31l-15 15v-15h-36q-12 0-12-12v-49q0-12 12-12Z" fill="${c.paper}"/>
    <path d="m831 261 12 12 28-30M736 173v22m-11-11h22M928 571v18m-9-9h18"/>
  </g>
  <g fill="${c.stroke}"><circle cx="470" cy="368" r="4"/><circle cx="929" cy="371" r="4"/><circle cx="659" cy="800" r="3"/><circle cx="537" cy="206" r="3"/></g>
</g>
<!-- Three separate overlay layers, matching the official Buddy scene-background structure. -->
<rect id="overlay-layer-1" width="1000" height="910" fill="url(#overlay-left)"/>
<rect id="overlay-layer-2" width="1000" height="910" fill="url(#overlay-top)"/>
<rect id="overlay-layer-3" width="1000" height="910" fill="url(#overlay-bottom)"/>
</svg>\n`;
  await writeFile(path.join(assets, `featured-${mode}.svg`), svg, 'utf8');
  await sharp(Buffer.from(svg)).resize(1000, 910).png().toFile(path.join(assets, `featured-${mode}.png`));
}
process.stdout.write('Generated day/night backgrounds at 1000x910, each with three vector overlay layers.\n');
