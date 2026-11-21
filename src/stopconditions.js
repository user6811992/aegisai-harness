// src/stopconditions.js
// Composable stop conditions for the agent loop.
function stepCountIs(n) { return (ctx) => ctx.stepCount >= n; }
function maxTokensUsed(n) { return (ctx) => ctx.totalTokens >= n; }
function maxCost(dollars) { return (ctx) => (ctx.totalCost || 0) >= dollars; }
function hasToolCall(name) { return (ctx) => (ctx.toolCalls || []).some((t) => t === name); }

function evaluate(stopWhen, ctx) {
  if (!stopWhen) return false;
  const conds = Array.isArray(stopWhen) ? stopWhen : [stopWhen];
  return conds.some((c) => {
    if (typeof c === 'function') return !!c(ctx);
    return false;
  });
}

module.exports = { stepCountIs, maxTokensUsed, maxCost, hasToolCall, evaluate };
