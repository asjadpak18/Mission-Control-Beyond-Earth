#!/usr/bin/env bun
/**
 * Generates destination artwork PNGs for the new v2.0 missions from SVG art
 * (deterministic, no external assets). Uses sharp (already a dependency).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "/home/z/my-project/public/images";
mkdirSync(OUT, { recursive: true });

const STARS = Array.from({ length: 90 }, (_, i) => {
  const x = (i * 137.507) % 600;
  const y = (i * 89.03) % 400;
  const r = ((i * 7) % 10) / 9 * 0.9 + 0.3;
  const o = 0.25 + ((i * 13) % 10) / 16;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#d6ecff" opacity="${o.toFixed(2)}"/>`;
}).join("");

function wrap(inner: string, extra = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>${extra}</defs>
  <rect width="600" height="400" fill="#04070f"/>
  <rect width="600" height="400" fill="url(#nebula)" opacity="0.55"/>
  ${STARS}
  ${inner}
</svg>`;
}

const NEBULA = `
  <radialGradient id="nebula" cx="30%" cy="70%" r="90%">
    <stop offset="0%" stop-color="#0a1a3a" stop-opacity="0.9"/>
    <stop offset="55%" stop-color="#071122" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#04070f" stop-opacity="0"/>
  </radialGradient>`;

const images: Record<string, string> = {
  // Mercury — cratered tan-grey planet close to a huge Sun glow
  mercury: wrap(`
  <circle cx="430" cy="120" r="150" fill="#ffb84d" opacity="0.10"/>
  <circle cx="430" cy="120" r="90" fill="#ffb84d" opacity="0.14"/>
  <radialGradient id="p" cx="36%" cy="32%" r="75%">
    <stop offset="0%" stop-color="#c9bda9"/>
    <stop offset="55%" stop-color="#8f8578"/>
    <stop offset="100%" stop-color="#4d463a"/>
  </radialGradient>
  <circle cx="240" cy="235" r="120" fill="url(#p)"/>
  <circle cx="200" cy="205" r="20" fill="#574f42" opacity="0.55"/>
  <circle cx="262" cy="268" r="14" fill="#574f42" opacity="0.5"/>
  <circle cx="292" cy="212" r="10" fill="#574f42" opacity="0.45"/>
  <circle cx="228" cy="290" r="8" fill="#574f42" opacity="0.4"/>
  <path d="M 130 260 Q 240 340 355 250" stroke="#3f3a30" stroke-width="2" fill="none" opacity="0.5"/>
  <path d="M 150 230 Q 250 300 345 235" stroke="#3f3a30" stroke-width="1.4" fill="none" opacity="0.4"/>`,
    NEBULA + `
  <radialGradient id="p" cx="36%" cy="32%" r="75%">
    <stop offset="0%" stop-color="#c9bda9"/>
    <stop offset="55%" stop-color="#8f8578"/>
    <stop offset="100%" stop-color="#4d463a"/>
  </radialGradient>`),

  // Sun — blazing star with corona arcs
  sun: wrap(`
  <circle cx="300" cy="210" r="230" fill="#ff9430" opacity="0.08"/>
  <circle cx="300" cy="210" r="180" fill="#ffb020" opacity="0.12"/>
  <radialGradient id="s" cx="42%" cy="38%" r="70%">
    <stop offset="0%" stop-color="#fff6cf"/>
    <stop offset="35%" stop-color="#ffd27a"/>
    <stop offset="75%" stop-color="#ff9430"/>
    <stop offset="100%" stop-color="#e06a10"/>
  </radialGradient>
  <circle cx="300" cy="210" r="130" fill="url(#s)"/>
  <path d="M 190 130 Q 120 60 205 40" stroke="#ffd27a" stroke-width="5" fill="none" opacity="0.7"/>
  <path d="M 420 150 Q 490 80 405 55" stroke="#ffb020" stroke-width="6" fill="none" opacity="0.6"/>
  <path d="M 175 300 Q 95 340 160 375" stroke="#ffb020" stroke-width="5" fill="none" opacity="0.55"/>
  <path d="M 430 305 Q 505 350 440 380" stroke="#ffd27a" stroke-width="4" fill="none" opacity="0.5"/>
  <circle cx="265" cy="185" r="16" fill="#e8852a" opacity="0.5"/>
  <circle cx="330" cy="240" r="11" fill="#e8852a" opacity="0.45"/>`,
    NEBULA + `
  <radialGradient id="s" cx="42%" cy="38%" r="70%">
    <stop offset="0%" stop-color="#fff6cf"/>
    <stop offset="35%" stop-color="#ffd27a"/>
    <stop offset="75%" stop-color="#ff9430"/>
    <stop offset="100%" stop-color="#e06a10"/>
  </radialGradient>`),

  // Europa — icy cracked moon over Jupiter limb glow
  europa: wrap(`
  <circle cx="520" cy="360" r="200" fill="#c9a97a" opacity="0.12"/>
  <radialGradient id="e" cx="38%" cy="30%" r="75%">
    <stop offset="0%" stop-color="#f2f9fd"/>
    <stop offset="55%" stop-color="#b8ccd8"/>
    <stop offset="100%" stop-color="#7195a8"/>
  </radialGradient>
  <circle cx="250" cy="200" r="125" fill="url(#e)"/>
  <path d="M 150 175 Q 250 205 345 165" stroke="#7195a8" stroke-width="2.4" fill="none" opacity="0.75"/>
  <path d="M 165 235 Q 260 200 350 245" stroke="#7195a8" stroke-width="1.8" fill="none" opacity="0.6"/>
  <path d="M 205 130 Q 245 190 230 270" stroke="#7195a8" stroke-width="1.6" fill="none" opacity="0.55"/>
  <path d="M 300 125 Q 285 190 310 268" stroke="#7195a8" stroke-width="1.4" fill="none" opacity="0.5"/>
  <circle cx="215" cy="160" r="7" fill="#93b4c4" opacity="0.7"/>
  <circle cx="290" cy="240" r="5" fill="#93b4c4" opacity="0.6"/>`,
    NEBULA + `
  <radialGradient id="e" cx="38%" cy="30%" r="75%">
    <stop offset="0%" stop-color="#f2f9fd"/>
    <stop offset="55%" stop-color="#b8ccd8"/>
    <stop offset="100%" stop-color="#7195a8"/>
  </radialGradient>`),

  // Saturn — banded planet with rings
  saturn: wrap(`
  <radialGradient id="sa" cx="38%" cy="32%" r="75%">
    <stop offset="0%" stop-color="#f0e0b0"/>
    <stop offset="55%" stop-color="#d9c08a"/>
    <stop offset="100%" stop-color="#9a7f4e"/>
  </radialGradient>
  <g transform="rotate(-12 300 210)">
    <ellipse cx="300" cy="210" rx="245" ry="62" fill="none" stroke="#c0a770" stroke-width="26" opacity="0.5"/>
    <ellipse cx="300" cy="210" rx="218" ry="54" fill="none" stroke="#e8d3a0" stroke-width="12" opacity="0.55"/>
    <ellipse cx="300" cy="210" rx="262" ry="67" fill="none" stroke="#8a7448" stroke-width="7" opacity="0.45"/>
  </g>
  <circle cx="300" cy="210" r="115" fill="url(#sa)"/>
  <path d="M 190 195 Q 300 215 410 190" stroke="#9a7f4e" stroke-width="9" fill="none" opacity="0.45"/>
  <path d="M 188 225 Q 300 245 412 222" stroke="#8a7448" stroke-width="7" fill="none" opacity="0.4"/>
  <path d="M 200 165 Q 300 180 400 162" stroke="#f0e0b0" stroke-width="5" fill="none" opacity="0.5"/>`,
    NEBULA + `
  <radialGradient id="sa" cx="38%" cy="32%" r="75%">
    <stop offset="0%" stop-color="#f0e0b0"/>
    <stop offset="55%" stop-color="#d9c08a"/>
    <stop offset="100%" stop-color="#9a7f4e"/>
  </radialGradient>`),

  // Titan — hazy orange moon with lakes
  titan: wrap(`
  <radialGradient id="t" cx="38%" cy="30%" r="78%">
    <stop offset="0%" stop-color="#f5cd8a"/>
    <stop offset="45%" stop-color="#d98f3e"/>
    <stop offset="100%" stop-color="#93581c"/>
  </radialGradient>
  <circle cx="300" cy="200" r="130" fill="url(#t)"/>
  <circle cx="300" cy="200" r="158" fill="#d98f3e" opacity="0.10"/>
  <path d="M 235 268 Q 262 284 296 274 Q 318 268 322 286 Q 292 300 258 292 Q 234 286 235 268 Z" fill="#5a3b14" opacity="0.55"/>
  <ellipse cx="352" cy="252" rx="26" ry="9" fill="#5a3b14" opacity="0.45"/>
  <path d="M 200 150 Q 300 120 400 152" stroke="#c17a2e" stroke-width="8" fill="none" opacity="0.4"/>
  <path d="M 190 190 Q 300 165 410 195" stroke="#c17a2e" stroke-width="6" fill="none" opacity="0.35"/>
  <path d="M 215 232 Q 300 210 392 234" stroke="#c17a2e" stroke-width="4" fill="none" opacity="0.3"/>`,
    NEBULA + `
  <radialGradient id="t" cx="38%" cy="30%" r="78%">
    <stop offset="0%" stop-color="#f5cd8a"/>
    <stop offset="45%" stop-color="#d98f3e"/>
    <stop offset="100%" stop-color="#93581c"/>
  </radialGradient>`),

  // Deep space — violet void, distant Sun, interstellar frontier
  deepspace: wrap(`
  <radialGradient id="d" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#3c2a5c"/>
    <stop offset="60%" stop-color="#241642"/>
    <stop offset="100%" stop-color="#0a0716"/>
  </radialGradient>
  <ellipse cx="300" cy="210" rx="270" ry="170" fill="url(#d)" opacity="0.85"/>
  <circle cx="70" cy="80" r="4" fill="#fff3c4"/>
  <circle cx="70" cy="80" r="14" fill="#ffe9a0" opacity="0.18"/>
  <circle cx="70" cy="80" r="30" fill="#ffe9a0" opacity="0.07"/>
  <path d="M 250 260 Q 300 240 352 258" stroke="#6e5a9c" stroke-width="1.4" fill="none" opacity="0.7" stroke-dasharray="3 5"/>
  <circle cx="300" cy="256" r="3" fill="#8fe9ff"/>
  <circle cx="300" cy="256" r="9" fill="none" stroke="#8fe9ff" stroke-width="1" opacity="0.5"/>
  <text x="320" y="248" font-family="monospace" font-size="10" fill="#8fb4d6" opacity="0.85">HELIOPAUSE →</text>`,
    NEBULA + `
  <radialGradient id="d" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#3c2a5c"/>
    <stop offset="60%" stop-color="#241642"/>
    <stop offset="100%" stop-color="#0a0716"/>
  </radialGradient>`),
};

for (const [name, svg] of Object.entries(images)) {
  const out = `${OUT}/dest-${name}.png`;
  await sharp(Buffer.from(svg)).resize(600, 400).png({ quality: 90 }).toFile(out);
  console.log(`wrote ${out}`);
}
