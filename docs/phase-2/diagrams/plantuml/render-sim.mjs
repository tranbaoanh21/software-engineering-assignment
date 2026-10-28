// node render-sim.mjs /path/to/plantuml.jar
import { readdirSync, readFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jar = process.argv[2];
if (!jar) throw new Error('Truyền đường dẫn plantuml.jar làm tham số.');
const java = process.env.UML_JAVA_BIN || 'java';
const convert = process.env.UML_RSVG_BIN || 'rsvg-convert';
const jobs = [
  ['sequence-uc-sim-01.puml', 'sequence', 'uc-sim-01', 1],
  ['sequence-uc-sim-02.puml', 'sequence', 'uc-sim-02', 1],
  ['activity-uc-sim-01.puml', 'activity', 'uc-sim-01', 1],
  ['activity-uc-sim-02.puml', 'activity', 'uc-sim-02', 1],
  ['state-simulation-run.puml', 'state', 'simulation-run', 1],
];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: here, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ': exit ' + result.status);
}

for (const [source, folder, stem, expectedPages] of jobs) {
  const out = resolve(here, '..', folder);
  const sourceStem = source.replace(/\.puml$/, '');
  run(java, ['-Djava.awt.headless=true', '-jar', jar, '-charset', 'UTF-8',
    '-tsvg', '-o', out, source]);
  const outputs = readdirSync(out).filter(name =>
    name === sourceStem + '.svg' ||
    (name.startsWith(sourceStem + '_') && /_\d+\.svg$/.test(name)));
  if (outputs.length !== expectedPages) {
    throw new Error(source + ': số hình khác dự kiến, kiểm tra newpage.');
  }
  for (const name of outputs) {
    const target = stem + name.slice(sourceStem.length);
    const sourcePath = join(out, name);
    const targetPath = join(out, target);
    const svg = readFileSync(sourcePath, 'utf8');
    if (/Syntax Error|Error line|An error has occurred|<a\b/.test(svg)) {
      throw new Error('Kiểm tra nhãn hoặc cú pháp: ' + name);
    }
    renameSync(sourcePath, targetPath);
    run(convert, ['-f', 'pdf', '-o',
      targetPath.replace(/\.svg$/, '.pdf'), targetPath]);
  }
}
