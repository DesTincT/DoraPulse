/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./webapp/index.html', './webapp/src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [require('daisyui')],
};
