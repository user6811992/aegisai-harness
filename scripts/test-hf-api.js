const http = require('https');
function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { 'User-Agent': 'AegisAI' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 500) }));
    }).on('error', (e) => resolve({ error: e.message }));
  });
}
(async () => {
  // Test 1: with filter=gguf
  console.log('=== Test 1: filter=gguf ===');
  console.log(JSON.stringify(await fetch('https://huggingface.co/api/models?search=llama&filter=gguf&sort=downloads&direction=-1&limit=5')));
  // Test 2: without filter
  console.log('=== Test 2: no filter ===');
  console.log(JSON.stringify(await fetch('https://huggingface.co/api/models?search=llama&sort=downloads&direction=-1&limit=5')));
  // Test 3: with tag
  console.log('=== Test 3: tag=gguf ===');
  console.log(JSON.stringify(await fetch('https://huggingface.co/api/models?search=llama&tag=gguf&sort=downloads&direction=-1&limit=5')));
  // Test 4: different search term
  console.log('=== Test 4: search=mistral ===');
  console.log(JSON.stringify(await fetch('https://huggingface.co/api/models?search=mistral&sort=downloads&direction=-1&limit=5')));
})();
