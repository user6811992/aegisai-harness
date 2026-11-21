// src/security_kb.js
// Security knowledge base: vulnerability classes + disclosure-report patterns.
const CLASSES = [
  { id: 'sqli', name: 'SQL Injection', patterns: ['union select', 'or 1=1', 'sleep(', 'boolean-based'] },
  { id: 'xss', name: 'Cross-Site Scripting', patterns: ['<script', 'onerror=', 'javascript:', 'payload'] },
  { id: 'ssrf', name: 'Server-Side Request Forgery', patterns: ['169.254.169.254', 'file://', 'gopher://', 'internal metadata'] },
  { id: 'rce', name: 'Remote Code Execution', patterns: [';cat ', '|sh', '$(', '反序列化', 'deserialization'] },
  { id: 'lfi', name: 'Local File Inclusion', patterns: ['../etc/passwd', '..%2f', 'php://filter'] },
  { id: 'auth', name: 'Authentication Bypass', patterns: ['jwt none', 'null byte', 'default credentials', 'id=1'] },
  { id: 'idor', name: 'Insecure Direct Object Reference', patterns: ['user_id=', 'invoice_id=', 'sequential id'] },
  { id: 'csrf', name: 'CSRF', patterns: ['no csrf token', 'same-site none', 'form auto-submit'] },
  { id: 'xxe', name: 'XXE', patterns: ['<!doctype', '<!entity', 'SYSTEM "file:'] },
  { id: 'ssti', name: 'Template Injection', patterns: ['{{7*7}}', '${7*7}', '<%= 7*7 %>'] },
  { id: 'prototype', name: 'Prototype Pollution', patterns: ['__proto__', 'constructor.prototype', 'Object.assign'] },
  { id: 'jwt', name: 'JWT Weakness', patterns: ['alg:none', 'weak secret', 'kid injection'] },
  { id: 'cors', name: 'CORS Misconfiguration', patterns: ['access-control-allow-origin: *', 'credential reflection'] },
  { id: 'redirect', name: 'Open Redirect', patterns: ['redirect=', 'url=', '//evil.com'] },
  { id: 'upload', name: 'Unrestricted Upload', patterns: ['shell.php', 'polyglot', 'content-type bypass'] },
  { id: 'race', name: 'Race Condition', patterns: ['toctou', 'double spend', 'parallel request'] },
  { id: 'deser', name: 'Insecure Deserialization', patterns: ['java serialized', 'pickle', 'ysoserial'] },
  { id: 'graphql', name: 'GraphQL Issues', patterns: ['introspection enabled', 'batch query', 'depth limit'] },
  { id: 'header', name: 'Header Injection', patterns: ['crlf', 'host header', 'x-forwarded-for'] },
  { id: 'cache', name: 'Cache Poisoning', patterns: ['cache key', 'unkeyed header', 'cdn poisoning'] },
  { id: 'subdomain', name: 'Subdomain Takeover', patterns: ['cname dangling', '404 azure', 'github pages'] },
  { id: 'oauth', name: 'OAuth Misconfiguration', patterns: ['redirect_uri', 'state parameter', 'implicit flow'] },
  { id: 'webcache', name: 'Web Cache Deception', patterns: [';css', '.css appended', 'cache deception'] },
  { id: 'business', name: 'Business Logic Flaw', patterns: ['negative price', 'quantity -1', 'coupon reuse', 'race discount'] },
];

function list() { return CLASSES.map((c) => ({ id: c.id, name: c.name, patternCount: c.patterns.length })); }
function match(text) {
  const t = String(text || '').toLowerCase();
  return CLASSES.map((c) => ({ id: c.id, name: c.name, hits: c.patterns.filter((p) => t.includes(p.toLowerCase())) })).filter((c) => c.hits.length);
}

module.exports = { CLASSES, list, match };
