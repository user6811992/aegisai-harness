const { execSync } = require('child_process');
try {
  const version = execSync('node --version').toString().trim();
  console.log('Node.js version:', version);
  
  try {
    const gypVersion = execSync('node-gyp --version').toString().trim();
    console.log('node-gyp version:', gypVersion);
  } catch (e) {
    console.log('node-gyp not found');
  }
} catch (e) {
  console.error('Error:', e.message);
}