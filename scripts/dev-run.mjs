import { spawn } from 'node:child_process';

// Set dev flags for DB-less mode and Telegram bypass
process.env.DORA_DEV_NO_DB = process.env.DORA_DEV_NO_DB || 'true';
process.env.DORA_DEV_BYPASS_TELEGRAM_AUTH = process.env.DORA_DEV_BYPASS_TELEGRAM_AUTH || 'true';
process.env.DORA_DEV_PROJECT_ID = process.env.DORA_DEV_PROJECT_ID || 'dev';

const port = process.env.PORT || 8080;
console.log('Local webapp preview (DB-less dev mode)');
console.log('Flags:');
console.log(`  DORA_DEV_NO_DB=${process.env.DORA_DEV_NO_DB}`);
console.log(`  DORA_DEV_BYPASS_TELEGRAM_AUTH=${process.env.DORA_DEV_BYPASS_TELEGRAM_AUTH}`);
console.log(`  DORA_DEV_PROJECT_ID=${process.env.DORA_DEV_PROJECT_ID}`);
console.log(`Open: http://localhost:${port}/webapp`);

// Start the server via tsx
const child = spawn('tsx', ['src/index.ts'], { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => {
  process.exit(code ?? 0);
});


