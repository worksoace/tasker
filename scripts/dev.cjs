const { spawn } = require('child_process');
const vite = require('vite');
const esbuild = require('esbuild');
const path = require('path');

async function start() {
  // Start Vite dev server
  const server = await vite.createServer({
    configFile: path.join(__dirname, '../vite.config.ts'),
    server: { port: 5174 }
  });
  await server.listen();
  console.log('Vite dev server running on http://localhost:5174');


  // Build main and preload watcher
  const ctxPreload = await esbuild.context({
    entryPoints: [path.join(__dirname, '../src/main/preload.ts')],
    bundle: true,
    platform: 'node',
    external: ['electron'],
    outfile: path.join(__dirname, '../dist/main/preload.cjs'),
    sourcemap: true,
  });
  await ctxPreload.watch();
  console.log('Watching preload...');

  const electronPath = require('electron');
  const { execSync } = require('child_process');
  let electronProcess = null;

  function killElectron() {
    if (electronProcess && electronProcess.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${electronProcess.pid} /T /F`, { stdio: 'ignore' });
        } else {
          electronProcess.kill('SIGINT');
        }
      } catch (e) {}
      electronProcess = null;
    }
  }

  process.on('exit', killElectron);
  process.on('SIGINT', () => { killElectron(); process.exit(); });
  process.on('SIGTERM', () => { killElectron(); process.exit(); });

  const ctxMain = await esbuild.context({
    entryPoints: [path.join(__dirname, '../src/main/index.ts')],
    bundle: true,
    platform: 'node',
    external: ['electron', 'electron-store'],
    outfile: path.join(__dirname, '../dist/main/index.cjs'),
    sourcemap: true,
    plugins: [{
      name: 'electron-restart',
      setup(build) {
        build.onEnd(() => {
          console.log('Main process rebuilt. Restarting Electron...');
          killElectron();
          electronProcess = spawn(electronPath, ['.'], { stdio: 'inherit' });
        });
      }
    }]
  });
  await ctxMain.watch();
  console.log('Watching main...');
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
