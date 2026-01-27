const path = require('node:path');

module.exports = {
  plugins: {
    tailwindcss: { config: path.resolve(__dirname, 'tailwind.webapp.config.cjs') },
    autoprefixer: {},
  },
};

