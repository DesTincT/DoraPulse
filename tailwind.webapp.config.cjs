const path = require('node:path');

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    toPosix(path.resolve(__dirname, 'webapp/index.html')),
    toPosix(path.resolve(__dirname, 'webapp/src/**/*.{js,jsx,ts,tsx}')),
  ],
  theme: { extend: {} },
  plugins: [require('daisyui')],
};

