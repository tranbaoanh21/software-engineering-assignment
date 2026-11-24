import { spawn } from 'node:child_process';

const children = new Set();
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;

  for (const child of children) child.kill('SIGTERM');

  const deadline = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 8000);
  deadline.unref();
}

function start(name, script, env = process.env) {
  const child = spawn(process.execPath, [script], { stdio: 'inherit', env });
  children.add(child);
  child.once('error', error => {
    children.delete(child);
    console.error(name + ' failed to start:', error.message);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(name + ' stopped:', signal ?? code);
    shutdown(1);
  });
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

start('API', 'apps/api/dist/main.js');

if (process.env.SIMULATOR_ENABLED === 'true') {
  start('IoT simulator', 'apps/iot-simulator/dist/main.js', {
    ...process.env,
    API_BASE_URL: 'http://127.0.0.1:3000',
    SIM_MODE: 'handoff',
  });
}
