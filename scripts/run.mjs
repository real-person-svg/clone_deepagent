import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// Prefer the user's active Node; also support existing local nvm/runtime installs.
const nvm = join(homedir(), '.nvm/versions/node');
const candidates = [
  process.execPath,
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'),
];
if (existsSync(nvm))
  candidates.push(
    ...readdirSync(nvm)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => join(nvm, v, 'bin/node'))
  );
const node = candidates.find((p) => {
  if (!existsSync(p)) return false;
  const result = spawnSync(
    p,
    [
      '-p',
      '((v) => v[0] > 22 || (v[0] === 22 && v[1] >= 16))(process.versions.node.split(".").map(Number))',
    ],
    { encoding: 'utf8' }
  );
  return result.status === 0 && result.stdout.trim() === 'true';
});
if (!node) {
  console.error(
    'This project requires Node.js 22.16+ (Node.js 24 recommended). Run nvm install && nvm use.'
  );
  process.exit(1);
}
const commands = {
  dev: [
    ['node_modules/tsx/dist/cli.mjs', 'watch', 'apps/server/index.ts'],
    ['node_modules/vite/bin/vite.js'],
  ],
  start: [['--import', 'tsx', 'apps/server/index.ts']],
  build: [
    ['node_modules/typescript/bin/tsc', '--noEmit'],
    ['node_modules/vite/bin/vite.js', 'build'],
  ],
  typecheck: [['node_modules/typescript/bin/tsc', '--noEmit']],
  test: [['node_modules/vitest/vitest.mjs', 'run']],
  'test:ui': [['node_modules/@playwright/test/cli.js', 'test']],
  'validate:live': [['--import', 'tsx', 'scripts/validate-live.ts']],
  format: [
    [
      'node_modules/prettier/bin/prettier.cjs',
      '--write',
      'apps',
      'packages',
      'tests',
      'scripts',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
    ],
  ],
};
const name = process.argv[2];
if (!(name in commands)) throw new Error('Unknown command');
const env = { ...process.env, PATH: `${join(node, '..')}:${process.env.PATH}` };
if (name === 'dev') {
  const children = commands.dev.map((args) => spawn(node, args, { stdio: 'inherit', env }));
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    children.forEach((p) => p.kill('SIGTERM'));
    setTimeout(() => process.exit(code), 200).unref();
  };
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  children.forEach((p) => p.on('exit', (code) => stop(code || 0)));
} else {
  for (const args of commands[name]) {
    const result = spawnSync(node, [...args, ...process.argv.slice(3)], { stdio: 'inherit', env });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
