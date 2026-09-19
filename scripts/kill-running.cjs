const { execSync } = require('child_process');

try {
  if (process.platform === 'win32') {
    execSync('taskkill /f /im "My Tasker Dev.exe" 2>nul', { stdio: 'ignore' });
  }
} catch (e) {
  // Process was not running, safe to continue
}
