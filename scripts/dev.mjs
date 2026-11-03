import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// Support Next.js locally and the host/port flags used by hosted previews.
const args = process.argv.slice(2)
  .filter((arg) => arg !== '--strictPort')
  .map((arg) => arg === '--host' ? '--hostname' : arg);

if (!args.includes('--hostname')) args.push('--hostname', '0.0.0.0');
if (!args.includes('--port') && !args.includes('-p')) args.push('--port', process.env.PORT || '3000');

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 0; });
