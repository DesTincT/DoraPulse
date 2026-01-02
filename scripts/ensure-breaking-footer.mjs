import fs from 'node:fs';

async function main() {
  const file = process.argv[2];
  if (!file) return;

  const msg = fs.readFileSync(file, 'utf8');
  const firstLine = msg.split(/\r?\n/)[0] || '';
  const hasBang = /![:)]/.test(firstLine) || /^(feat|fix|refactor|perf)(\(.+\))?!:/.test(firstLine);
  if (!hasBang) return;

  const hasFooter = /^BREAKING CHANGE:/m.test(msg);
  if (hasFooter) return;

  console.error('Commit uses breaking change indicator "!" but is missing required "BREAKING CHANGE:" footer.');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
