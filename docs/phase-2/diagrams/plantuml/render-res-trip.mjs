// node render-res-trip.mjs /path/to/plantuml.jar
import { readFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jar = process.argv[2];
if (!jar) throw new Error('Truyền đường dẫn plantuml.jar làm tham số.');
const jobs = [
  ['state-vehicle-reservation', 'state', 'vehicle-reservation'],
  ['sequence-uc-trip-01', 'sequence', 'uc-trip-01'],
  ['sequence-uc-trip-02', 'sequence', 'uc-trip-02'],
  ['activity-uc-trip-01', 'activity', 'uc-trip-01'],
  ['activity-uc-trip-02', 'activity', 'uc-trip-02'],
  ['state-trip', 'state', 'trip'],
  ['state-shared-vehicle', 'state', 'shared-vehicle'],
];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: here, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command}: exit ${result.status}`);
}

for (const [source, folder, target] of jobs) {
  const out = resolve(here, '..', folder);
  run(process.env.UML_JAVA_BIN || 'java', [
    '-Djava.awt.headless=true', '-jar', jar, '-charset', 'UTF-8',
    '-tsvg', '-o', out, `${source}.puml`,
  ]);
  const sourcePath = join(out, `${source}.svg`);
  const svg = readFileSync(sourcePath, 'utf8');
  if (/Syntax Error|Error line|An error has occurred|<a\b/.test(svg)) {
    throw new Error(`Kiểm tra cú pháp hoặc hyperlink trong ${source}.puml`);
  }
  const targetPath = join(out, `${target}.svg`);
  renameSync(sourcePath, targetPath);
  run(process.env.UML_RSVG_BIN || 'rsvg-convert', [
    '-f', 'pdf', '-o', join(out, `${target}.pdf`), targetPath,
  ]);
  console.log(`${source}.puml -> ${folder}/${target}.svg, .pdf`);
}
