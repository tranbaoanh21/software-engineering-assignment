// Render the teaching examples. Usage: node render-examples.mjs /path/to/plantuml.jar
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const figures = join(here, 'figures');
const jar = process.argv[2];
if (!jar) throw new Error('Pass the path to a local PlantUML JAR.');
const java = process.env.UML_JAVA_BIN || 'java';
const convert = process.env.UML_RSVG_BIN || 'rsvg-convert';
function run(command, args) {
  const result = spawnSync(command, args, { cwd: figures, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed: ' + result.status);
}
const sources = readdirSync(figures).filter(name => /^example-.*\.puml$/.test(name));
run(java, ['-Djava.awt.headless=true', '-jar', jar, '-charset', 'UTF-8', '-tsvg', '-o', 'output', ...sources]);

// Smetana places this return-edge label over its own curve.
// Move only the two text lines; keep the UML nodes and transitions unchanged.
const overview = join(figures, 'output', 'example-state-job.svg');
let svg = readFileSync(overview, 'utf8');
let fixed = false;
svg = svg.replace(/<g class="link"[\s\S]*?<\/g>/g, group => {
  if (group.includes('resume [điều kiện an toàn]')) {
    fixed = true;
    return group.replace(/(<text\b[^>]*?\by=")([\d.]+)(")/g,
      (_, before, y, after) => before + (Number(y) - 32).toFixed(3) + after);
  }
  const dx = group.includes('pauseRequested') ? -18
    : group.includes('cancel [được phép]') ? -12 : 0;
  return group.replace(/(<text\b[^>]*?\bx=")([\d.]+)(")/g,
    (_, before, x, after) => before + (Number(x) + dx).toFixed(3) + after);
});
if (!fixed) throw new Error('The resume label was not found; inspect the state layout.');
writeFileSync(overview, svg);
for (const name of readdirSync(join(figures, 'output')).filter(name => /^example-.*\.svg$/.test(name))) {
  run(convert, ['-f', 'pdf', '-o', join('output', name.replace(/\.svg$/, '.pdf')), join('output', name)]);
}
