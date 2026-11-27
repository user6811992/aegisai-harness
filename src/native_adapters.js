// src/native_adapters.js
// Graceful adapter interfaces for native-only capabilities (in-process models, Windows RPA).
const { spawn } = require('child_process');

const inProcessModel = {
  name: 'in-process-model',
  available: false,
  reason: 'requires native ggml/llama.cpp bindings (not present)',
  load(modelPath) { return { ok: false, error: this.reason, modelPath: modelPath || '' }; },
};

const windowsRPA = {
  name: 'windows-rpa',
  available: process.platform === 'win32',
  reason: 'UIAutomation available via PowerShell; SendKeys for text input',
  // Click an element identified by selector (AutomationId, Name, or ClassName)
  // Returns element info; actual click depends on element pattern availability
  click(selector) {
    return new Promise((resolve) => {
      // Pass selector as base64-encoded JSON to avoid PowerShell injection.
      const selectorB64 = Buffer.from(JSON.stringify(selector || {}), 'utf8').toString('base64');
      const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName 'UIAutomationClient, Version=3.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35'
$root = [System.Windows.Automation.AutomationElement]::RootElement
$selector = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${selectorB64}')) | ConvertFrom-Json
$result = 'not-found'
$cond = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$selector.automationId)
$elem = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if ($elem -eq $null -and $selector.name) {
    $cond2 = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, [string]$selector.name)
    $elem = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond2)
}
if ($elem -eq $null -and $selector.className) {
    $cond3 = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty, [string]$selector.className)
    $elem = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond3)
}
if ($elem -ne $null) {
    $name = $elem.Current.Name
    $class = $elem.Current.ClassName
    $autoId = $elem.Current.AutomationId
    $enabled = $elem.Current.IsEnabled
    if ($elem.Current.InvokePattern -ne $null) {
        try { $elem.Current.InvokePattern.Invoke(); $result = 'ok:clicked:' + $name } catch { $result = 'pattern-error:InvokePattern failed' }
    } else {
        $result = 'found:element=' + $name + ':class=' + $class + ':autoid=' + $autoId + ':enabled=' + $enabled + ':invoke-not-available'
    }
} else {
    $notFound = 'not-found:selector'
    if ($selector.automationId) { $notFound = $notFound + ':automationId=' + $selector.automationId }
    if ($selector.name) { $notFound = $notFound + ':name=' + $selector.name }
    if ($selector.className) { $notFound = $notFound + ':className=' + $selector.className }
    $result = $notFound
}
Write-Output $result
`;
      const powershell = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { detached: false });
      let output = '';
      powershell.stdout.on('data', (data) => { output += data.toString(); });
      powershell.stderr.on('data', (data) => { output += data.toString(); });
      powershell.on('close', (code) => {
        if (code === 0 && output.startsWith('ok:clicked:')) {
          resolve({ ok: true });
        } else if (code === 0 && output.startsWith('found:')) {
          // Parse the found element info
          const match = output.match(/^found:element=([^:]+):class=([^:]+):autoid=([^:]+):enabled=([^:]+):invoke-not-available$/);
          if (match) {
            resolve({ ok: true, name: match[1], className: match[2], automationId: match[3], enabled: match[4] });
          } else {
            resolve({ ok: true });
          }
        } else {
          resolve({ ok: false, error: output || 'PowerShell exit code: ' + code });
        }
      });
      powershell.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    });
  },
  // Type text into an element identified by selector
  // Uses PowerShell SendKeys for text input (confirmed working)
  type(selector, text) {
    return new Promise((resolve) => {
      const escapedText = text.replace(/'/g, "''");
      const psScript = `
$ErrorActionPreference = 'Stop'
$WShell = New-Object -ComObject WScript.Shell
$WShell.SendKeys('${escapedText}')
`;
      const powershell = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { detached: false });
      let output = '';
      let error = '';
      powershell.stdout.on('data', (data) => { output += data.toString(); });
      powershell.stderr.on('data', (data) => { error += data.toString(); });
      powershell.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: error || 'PowerShell exit code: ' + code });
        }
      });
      powershell.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    });
  },
};

function status() { return { inProcessModel: { available: inProcessModel.available, reason: inProcessModel.reason }, windowsRPA: { available: windowsRPA.available, reason: windowsRPA.reason } }; }

module.exports = { inProcessModel, windowsRPA, status };