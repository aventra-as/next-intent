import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const metadata = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
  }),
);
const files = new Set(pack.files.map((file) => file.path));
for (const path of [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/core/index.js',
  'dist/core/index.d.ts',
  'README.md',
  'LICENSE',
])
  assert(files.has(path), `Missing ${path}`);
for (const file of files)
  assert(
    !/^(src|test|examples|coverage|e2e)\//.test(file),
    `Unexpected packed file ${file}`,
  );
for (const [name, value] of Object.entries(metadata.exports)) {
  if (name === './package.json') continue;
  for (const target of Object.values(value))
    assert(files.has(target.replace(/^\.\//, '')), `Missing export ${target}`);
}
for (const entry of ['index', 'react', 'pages']) {
  const code = await readFile(
    new URL(`../dist/${entry}.js`, import.meta.url),
    'utf8',
  );
  assert(
    /^['"]use client['"]/.test(code),
    `Missing client directive in ${entry}`,
  );
}
const { predictIntent } = await import('next-intent/core');
const { createIntentObserver } = await import('next-intent/browser');
assert.equal(predictIntent([], []), null);
createIntentObserver(() => {
  throw new Error('SSR prefetch');
}).destroy();
assert.equal(metadata.sideEffects, false);
assert.equal(Object.keys(metadata.dependencies ?? {}).length, 0);

// Compile a consumer against files extracted from the real npm archive.
const temporary = await mkdtemp(join(tmpdir(), 'next-intent-package-'));
try {
  const [archive] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
      { encoding: 'utf8' },
    ),
  );
  execFileSync('tar', [
    '-xzf',
    join(temporary, archive.filename),
    '-C',
    temporary,
  ]);
  await mkdir(join(temporary, 'node_modules'));
  await symlink(
    join(temporary, 'package'),
    join(temporary, 'node_modules/next-intent'),
  );
  for (const dependency of ['next', 'react', '@types']) {
    await symlink(
      fileURLToPath(new URL(`../node_modules/${dependency}`, import.meta.url)),
      join(temporary, 'node_modules', dependency),
    );
  }
  await writeFile(
    join(temporary, 'consumer.tsx'),
    `
import { NextIntent, IntentLink, useNextIntent } from 'next-intent';
import { NextIntent as PagesIntent } from 'next-intent/pages';
import { useIntent } from 'next-intent/react';
import { createIntentObserver } from 'next-intent/browser';
import { predictIntent } from 'next-intent/core';
export function Consumer() {
  useNextIntent({ mode: 'balanced' });
  useIntent((href, { onInvalidate }) => { onInvalidate(); });
  return <><NextIntent /><PagesIntent /><IntentLink href="/a">Go</IntentLink></>;
}
createIntentObserver(() => {}).destroy();
const prediction = predictIntent([], [{ id: 'a', rect: { left: 0, right: 10, top: 0, bottom: 10 } }]);
const target: string | undefined = prediction?.target.id;
`,
  );
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/typescript-compiler/bin/tsc', import.meta.url),
      ),
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--jsx',
      'react-jsx',
      join(temporary, 'consumer.tsx'),
    ],
    { stdio: 'pipe' },
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log(
  `Package verified: ${files.size} files, ${(pack.size / 1024).toFixed(1)} kB archive, ESM exports and client boundaries intact.`,
);
