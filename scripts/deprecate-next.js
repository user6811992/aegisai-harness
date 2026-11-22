const fs = require('fs');
const https = require('https');

const SHA = '6f54a3a831e5c97407ef675dcba04097b059bfef';
const { execSync } = require('child_process');
const TOKEN = process.env.GITHUB_TOKEN || execSync('gh auth token', { encoding: 'utf8' }).trim();

const banner = '> [!CAUTION]\n> **DEPRECATED.** This project (`aegisai-next`) is deprecated and no longer actively maintained.\n> All features have been ported to and superseded by [`aegisai-harness`](https://github.com/user6811992/aegisai-harness),\n> which is now the primary, actively developed project. Please migrate to `aegisai-harness`.\n\n';

// Fetch current README
const getOpts = { hostname: 'api.github.com', path: '/repos/user6811992/aegisai-next/contents/README.md', headers: { 'User-Agent': 'aegisai-harness', 'Accept': 'application/vnd.github+json' } };
if (TOKEN) getOpts.headers['Authorization'] = 'token ' + TOKEN;

https.get(getOpts, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    const json = JSON.parse(body);
    const current = Buffer.from(json.content, 'base64').toString('utf8');
    const newContent = banner + current;
    const newSha = json.sha;
    const payload = JSON.stringify({ message: 'docs: mark project deprecated in favor of aegisai-harness', content: Buffer.from(newContent).toString('base64'), sha: newSha });
    const req = https.request({ hostname: 'api.github.com', path: '/repos/user6811992/aegisai-next/contents/README.md', method: 'PUT', headers: { 'User-Agent': 'aegisai-harness', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...(TOKEN ? { 'Authorization': 'token ' + TOKEN } : {}) } }, (res2) => {
      let b2 = '';
      res2.on('data', (c) => { b2 += c; });
      res2.on('end', () => { console.log('status:', res2.statusCode); console.log(b2.slice(0, 300)); });
    });
    req.write(payload);
    req.end();
  });
});
