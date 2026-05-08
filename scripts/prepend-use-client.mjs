import { readFile, writeFile } from 'node:fs/promises';

const directive = "'use client';";
const files = ['dist/hooks.js', 'dist/hooks.cjs'];

for (const file of files) {
  const source = await readFile(file, 'utf8');

  if (source.startsWith(directive) || source.startsWith('"use client";')) {
    continue;
  }

  await writeFile(file, `${directive}\n${source}`);
}
