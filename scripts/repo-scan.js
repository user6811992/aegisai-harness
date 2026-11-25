// scripts/repo-scan.js — list a GitHub org/user's top repos (public API).
const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'aegisai-repo-scan', Accept: 'application/vnd.github+json' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
(async () => {
  for (const u of process.argv.slice(2)) {
    console.log('\n=== ' + u + ' ===');
    try {
      const repos = await get('https://api.github.com/users/' + u + '/repos?per_page=40&sort=updated');
      const sorted = repos.slice().sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
      for (const r of sorted.slice(0, 10)) {
        console.log('  ' + r.name + '  [*' + (r.stargazers_count || 0) + ']  ' + (r.language || '-') + ' :: ' + (r.description || '').slice(0, 110));
      }
    } catch (e) { console.log('  error: ' + e.message); }
    await new Promise((r) => setTimeout(r, 400));
  }
})();
