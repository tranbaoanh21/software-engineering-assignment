// node render-system.mjs /path/to/plantuml.jar
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jar = process.argv[2];
if (!jar) throw new Error('Truyền đường dẫn plantuml.jar làm tham số.');
const out = resolve(here, '../system');
mkdirSync(out, { recursive: true });
function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: here, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(cmd + ': exit ' + result.status);
}
for (const name of ['system-context', 'system-use-case']) {
  run(process.env.UML_JAVA_BIN || 'java', [
    '-Djava.awt.headless=true', '-jar', jar, '-charset', 'UTF-8',
    '-tsvg', '-o', out, name + '.puml',
  ]);
  const svg = resolve(out, name + '.svg');
  if (/Syntax Error|Error line|An error has occurred/.test(readFileSync(svg, 'utf8'))) {
    throw new Error('Lỗi render: ' + name);
  }
  run(process.env.UML_RSVG_BIN || 'rsvg-convert', [
    '-f', 'pdf', '-o', resolve(out, name + '.pdf'), svg,
  ]);
  console.log(name + ' -> SVG/PDF');
}
