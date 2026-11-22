import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = fileURLToPath(new URL('../apps/api/', import.meta.url));
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

function run(args, cwd) {
  return spawn(process.execPath, args, { cwd, stdio: 'inherit' });
}

function wait(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error('Process exited with ' + (code ?? signal)));
    });
  });
}

await wait(run([compiler, '-p', 'packages/contracts/tsconfig.json'], root));
await wait(run([compiler, '-p', 'tsconfig.json'], api));

const children = [
  run([compiler, '--watch', '-p', 'tsconfig.json', '--preserveWatchOutput'], api),
  run(['--watch', '--env-file-if-exists=../../.env', 'dist/main.js'], api),
  run([vite], web),
];
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  await Promise.race(children.map(wait));
} finally {
  stop();
}
