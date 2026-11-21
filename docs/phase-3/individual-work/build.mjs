import {spawn} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const group = resolve(root, '../group-report');
const selected = new Set(process.argv.slice(2));
const reports = readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, 'main.tex')))
  .map(entry => {
    const dir = join(root, entry.name);
    const source = readFileSync(join(dir, 'main.tex'), 'utf8');
    const id = source.match(/\\IndividualId\}\{(\d+)\}/)?.[1];
    if (!id) throw new Error(`Thiếu MSSV: ${entry.name}`);
    return {dir, id, name: entry.name, source};
  }).filter(report => !selected.size || selected.has(report.id));
if (!reports.length || (selected.size && reports.length !== selected.size)) {
  throw new Error('MSSV không khớp danh sách báo cáo cá nhân.');
}

// Đọc đủ các đối số TeX, giữ nguyên nội dung bảng/ca kiểm thử của nhóm.
function argumentsAt(text, offset, count) {
  const values = [];
  let cursor = offset;
  for (let arg = 0; arg < count; arg++) {
    while (/\s/.test(text[cursor] ?? '') && cursor < text.length) cursor++;
    if (text[cursor] !== '{') throw new Error(`Thiếu đối số TeX tại ${cursor}`);
    const start = ++cursor;
    let depth = 1;
    while (cursor < text.length && depth) {
      if (text[cursor] === '\\') { cursor += 2; continue; }
      if (text[cursor] === '{') depth++;
      if (text[cursor] === '}') depth--;
      cursor++;
    }
    if (depth) throw new Error('Đối số TeX chưa đóng.');
    values.push(text.slice(start, cursor - 1));
  }
  return {values, end: cursor};
}

const testSource = readFileSync(join(group, 'sections/05-test-cases.tex'), 'utf8');
const testBlocks = new Map();
for (const match of testSource.matchAll(/\\SystemTest(?=\{TC-)/g)) {
  const parsed = argumentsAt(testSource, match.index + '\\SystemTest'.length, 4);
  testBlocks.set(parsed.values[0], testSource.slice(match.index, parsed.end));
}
const testSetup = testSource.slice(testSource.indexOf('\\newenvironment{SystemTestCases}'), testSource.indexOf('\\ReserveSpace{12'));
const fixture = testSource.match(/^Dùng DB test[^\n]+/m)?.[0];
if (!fixture || testBlocks.size !== 32) throw new Error('Bộ test nhóm không khớp cấu trúc 32 ca hiện tại.');

const allSections = new Map();
function collectSections(file, result = new Map()) {
  if (result.has(file)) return result;
  const text = readFileSync(join(group, `${file}.tex`), 'utf8');
  result.set(file, text);
  for (const match of text.matchAll(/\\PhaseThreeInput\{([^}]+)\}/g)) collectSections(match[1], result);
  return result;
}
for (const file of ['sections/01-design-baseline', 'sections/03-common-class-design',
  ...['00-gen','01-sub-hub','02-sub-res','03-sub-trip','04-sub-park','05-sub-chg','06-sub-ops','07-sub-sim'].map(name => `sections/class-design/${name}`)]) {
  for (const [name, text] of collectSections(file)) allSections.set(name, text);
}

const contracts = new Map();
for (const label of ['tab:p3-resource-owner-port', 'tab:p3-trip-res-contract', 'tab:p3-charging-point-owner']) {
  const owner = [...allSections.values()].find(text => text.includes(`\\label{${label}}`));
  if (!owner) throw new Error(`Thiếu hợp đồng: ${label}`);
  const position = owner.indexOf(`\\label{${label}}`);
  const start = owner.lastIndexOf('\\begin{longtable}', position);
  const end = owner.indexOf('\\end{longtable}', position) + '\\end{longtable}'.length;
  if (start < 0 || end <= position) throw new Error(`Bảng hợp đồng không đầy đủ: ${label}`);
  contracts.set(label, owner.slice(start, end));
}

const mainSource = readFileSync(join(group, 'main.tex'), 'utf8');
const preamble = mainSource.slice(mainSource.indexOf('\n') + 1, mainSource.indexOf('\\begin{document}'));
const buildRoot = mkdtempSync(join(tmpdir(), 'semh-phase-3-individuals-'));
console.log(`Build tạm: ${buildRoot}`);

async function compile(report) {
  const work = join(buildRoot, report.id);
  mkdirSync(work, {recursive: true});
  writeFileSync(join(work, 'individual-group-preamble.tex'), preamble);
  const included = new Map();
  for (const match of report.source.matchAll(/\\PhaseThreeInput\{([^}]+)\}/g)) collectSections(match[1], included);
  let contents = [...included.values()].join('\n');
  const excerpts = [];
  for (const [label, table] of contracts) {
    if (contents.includes(`\\ref{${label}}`) && !contents.includes(`\\label{${label}}`)) {
      excerpts.push(table);
      contents += '\n' + table;
    }
  }
  if (!excerpts.length) throw new Error(`${report.id}: không tìm thấy hợp đồng tham chiếu cần trích.`);
  writeFileSync(join(work, 'individual-contracts.tex'), excerpts.join('\n\n\\ReserveSpace{8\\baselineskip}\n\n') + '\n');

  const ids = report.source.match(/% TestCases: ([A-Z0-9,\-]+)/)?.[1].split(',');
  if (!ids?.length || new Set(ids).size !== ids.length) throw new Error(`${report.id}: danh sách test không hợp lệ.`);
  const core = ids.filter(id => !id.startsWith('TC-COM-'));
  const common = ids.filter(id => id.startsWith('TC-COM-'));
  const table = (title, list) => `\\begin{SystemTestCases}{${title}}\n${list.map(id => {
    if (!testBlocks.has(id)) throw new Error(`Không có test ${id}`);
    return testBlocks.get(id);
  }).join('\n')}\n\\end{SystemTestCases}\n`;
  let tests = `Các bảng ghi điều kiện, thao tác và kết quả mong đợi; chưa có kết quả thực thi.\n\n${fixture}\n\n${testSetup}\n`;
  tests += '\\subsection{Các luồng chức năng thuộc phạm vi báo cáo}\n' + table('Kiểm thử chức năng', core);
  tests += '\\ReserveSpace{10\\baselineskip}\n\\subsection{Rủi ro và tích hợp liên quan}\n' + table('Kiểm thử rủi ro và tích hợp', common);
  if (report.id === '2410155') tests += '\n' + testSource.slice(testSource.indexOf('\\subsection{Kế hoạch kiểm chứng NFR}'));
  writeFileSync(join(work, 'individual-test-cases.tex'), tests);
  const logPath = join(work, 'build.log');
  const log = createWriteStream(logPath);
  const job = `phase-3-${report.id}-individual-report`;
  await new Promise((resolveJob, reject) => {
    const child = spawn('latexmk', ['-xelatex', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error',
      `-jobname=${job}`, `-outdir=${work}`, 'main.tex'], {
      cwd: report.dir, env: {...process.env, TEXINPUTS: work + delimiter + (process.env.TEXINPUTS ?? '')},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
    child.once('error', error => { log.end(); reject(error); });
    child.once('close', code => { log.end(); code === 0 ? resolveJob() : reject(new Error(`${report.id}: compile thất bại, xem ${logPath}`)); });
  });
  const result = readFileSync(join(work, `${job}.log`), 'utf8');
  const errors = result.split('\n').filter(line => /Overfull|undefined|multiply defined|Missing character/.test(line));
  if (errors.length) throw new Error(`${report.id}: cần kiểm tra PDF: ${errors.join('\n')}`);
  const out = join(report.dir, 'output/pdf'); mkdirSync(out, {recursive: true});
  copyFileSync(join(work, `${job}.pdf`), join(out, `${job}.pdf`));
  writeFileSync(join(work, 'source-selection.json'), JSON.stringify({id: report.id, sections: [...included.keys()], tests: ids, contracts: excerpts.length}, null, 2));
  console.log(`OK ${report.id}: ${report.name}/output/pdf/${job}.pdf`);
}

let next = 0;
async function worker() { while (next < reports.length) await compile(reports[next++]); }
await Promise.all(Array.from({length: Math.min(3, reports.length)}, worker));
