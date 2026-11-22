// src/time_tool.js
// Time and timezone conversion (modelcontextprotocol/servers "Time").
function now(tz) {
  const d = new Date();
  let label = 'UTC';
  if (tz) {
    try {
      const s = d.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' });
      label = tz + ' (' + s.split(' ').pop() + ')';
    } catch (e) { return { ok: false, error: 'unknown timezone: ' + tz }; }
  }
  return { ok: true, iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), timezone: tz || 'UTC', label };
}
function convert(iso, fromTz, toTz) {
  try {
    const d = new Date(iso);
    const from = d.toLocaleString('en-US', { timeZone: fromTz });
    const to = d.toLocaleString('en-US', { timeZone: toTz });
    return { ok: true, from: fromTz + ': ' + from, to: toTz + ': ' + to };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
function listTimezones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return []; }
}

module.exports = { now, convert, listTimezones };
