import { spawn } from 'node:child_process';

const children = new Map();
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;

  for (const [child, { stopSignal }] of children) child.kill(stopSignal);

  const deadline = setTimeout(() => {
    for (const child of children.keys()) child.kill('SIGKILL');
  }, 8000);
  deadline.unref();
}

function start(name, executable, args, options = {}, stopSignal = 'SIGTERM') {
  const child = spawn(executable, args, { stdio: 'inherit', ...options });
  children.set(child, { stopSignal });
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

const appUser = { uid: 1000, gid: 1000 };
start('API', process.execPath, ['apps/api/dist/main.js'], appUser);

if (process.env.SIMULATOR_ENABLED === 'true') {
  start('IoT simulator', process.execPath, ['apps/iot-simulator/dist/main.js'], {
    ...appUser,
    env: { ...process.env, API_BASE_URL: 'http://127.0.0.1:3000', SIM_MODE: 'handoff' },
  });
}

start('Nginx', 'nginx', ['-g', 'daemon off;'], {}, 'SIGQUIT');
