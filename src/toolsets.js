// src/toolsets.js
// Declarative tool-set activation by situation.
function resolve(tools, situation) {
  situation = situation || {};
  const enabled = situation.enabled || null;
  const disabled = situation.disabled || [];
  return (tools || []).filter((t) => {
    const name = (t.function && t.function.name) || t.name;
    if (Array.isArray(enabled) && !enabled.includes(name)) return false;
    if (Array.isArray(disabled) && disabled.includes(name)) return false;
    return true;
  });
}

function createToolSet(def) {
  def = def || {};
  return {
    resolve: (situation) => resolve(def.tools || [], Object.assign({}, def, situation)),
  };
}

module.exports = { resolve, createToolSet };
