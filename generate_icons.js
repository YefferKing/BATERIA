const fs = require('fs');
const path = require('path');

function createSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.25}, ${size * 0.25}) scale(${size / 48})">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9 12l2 2 4-4" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons', { recursive: true });
}

fs.writeFileSync('icons/icon-192.svg', createSvg(192));
fs.writeFileSync('icons/icon-512.svg', createSvg(512));
console.log('Iconos SVG creados.');
