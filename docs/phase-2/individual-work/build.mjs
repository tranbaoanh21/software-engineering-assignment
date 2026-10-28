import {spawn} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const selected = new Set(process.argv.slice(2));
const reports = readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, 'main.tex')))
  .map(entry => {
    const dir = join(root, entry.name);
    const id = readFileSync(join(dir, 'main.tex'), 'utf8').match(/\\IndividualId\}\{(\d+)\}/)?.[1];
    if (!id) throw new Error(`Thiếu MSSV: ${entry.name}`);
    return {dir, id, name: entry.name};
  }).filter(report => !selected.size || selected.has(report.id));
if (!reports.length || (selected.size && reports.length !== selected.size)) {
  throw new Error('MSSV không khớp danh sách báo cáo cá nhân.');
}

async function compile(report) {
  const outdir = join(report.dir, 'output', 'pdf');
  mkdirSync(outdir, {recursive: true});
  const log = createWriteStream(join(outdir, 'build.log'));
  const job = `phase-2-${report.id}-individual-report`;
  await new Promise((resolve, reject) => {
    const child = spawn('latexmk', [
      '-xelatex', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error',
      `-jobname=${job}`, '-outdir=output/pdf', 'main.tex',
    ], {cwd: report.dir, stdio: ['ignore', 'pipe', 'pipe']});
    child.stdout.pipe(log, {end: false});
    child.stderr.pipe(log, {end: false});
    child.once('error', error => { log.end(); reject(error); });
    child.once('close', code => {
      log.end();
      if (code === 0 && existsSync(join(outdir, `${job}.pdf`))) resolve();
      else reject(new Error(`${report.name}: compile thất bại; xem output/pdf/build.log`));
    });
  });
  console.log(`OK ${report.id}: ${report.name}/output/pdf/${job}.pdf`);
}

let next = 0;
async function worker() {
  while (next < reports.length) await compile(reports[next++]);
}
await Promise.all(Array.from({length: Math.min(3, reports.length)}, worker));
