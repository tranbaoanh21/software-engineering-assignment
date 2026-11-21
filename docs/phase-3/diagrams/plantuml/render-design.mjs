// node render-design.mjs /path/to/plantuml.jar
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const jar = process.argv[2];
if (!jar) throw new Error('Truyền đường dẫn plantuml.jar.');
const requested = new Set(process.argv.slice(3));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: here, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ': exit ' + result.status);
}
for (const [name, relativeOutput] of [
  ['deployment-view', '../../architecture'],
  ['implementation-view', '../../architecture'],
  ['system-class-overview', '../class'],
  ['00-gen', '../class'],
  ['shared-services', '../class'],
  ['03-sub-trip', '../class'],
  ['07-sub-sim', '../class'],
  ['07-sub-sim-services', '../class'],
]) {
  if (requested.size && !requested.has(name)) continue;
  const output = resolve(here, relativeOutput);
  mkdirSync(output, { recursive: true });
  if (name === 'system-class-overview') {
    // TikZ cố định đường nối của toàn mô hình trên một hình vector.
    const temporary = mkdtempSync(resolve(tmpdir(), 'semh-class-overview-'));
    try {
      run('xelatex', ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error',
        '-output-directory=' + temporary, resolve(here, '../tikz/system-class-overview.tex')]);
      const pdf = resolve(output, name + '.pdf');
      copyFileSync(resolve(temporary, name + '.pdf'), pdf);
      run('pdftocairo', ['-svg', pdf, resolve(output, name + '.svg')]);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
    console.log(name + ' -> SVG/PDF');
    continue;
  }
  run(process.env.UML_JAVA_BIN || 'java', [
    '-Djava.awt.headless=true', '-jar', jar, '-charset', 'UTF-8',
    '-tsvg', '-o', output, name + '.puml',
  ]);
  const svg = resolve(output, name + '.svg');
  if (/Syntax Error|Error line|An error has occurred/.test(readFileSync(svg, 'utf8'))) {
    throw new Error('Lỗi PlantUML: ' + name);
  }
  run(process.env.UML_RSVG_BIN || 'rsvg-convert', ['-f', 'pdf', '-o', resolve(output, name + '.pdf'), svg]);
  console.log(name + ' -> SVG/PDF');
}
