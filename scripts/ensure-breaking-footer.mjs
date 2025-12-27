import fs from 'node:fs';

const file = process.argv[2];
if (!file) process.exit(0);
const msg = fs.readFileSync(file, 'utf8');
const firstLine = msg.split(/\r?\n/)[0] || '';
const hasBang = /![:\)]/.test(firstLine) || /^(feat|fix|refactor|perf)(\(.+\))?!:/.test(firstLine);
if (!hasBang) process.exit(0);
const hasFooter = /^BREAKING CHANGE:/m.test(msg);
if (!hasFooter) {
  console.error(
    'Commit uses breaking change indicator "!" but is missing required "BREAKING CHANGE:" footer.',
  );
  process.exit(1);
}


