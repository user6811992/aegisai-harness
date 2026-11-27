// src/classroom.js
// Multi-agent interactive classroom — clean-room THU-MAIC/OpenMAIC (44,865⭐,
// MIT) idea. Simulated students/teachers with roles, turn-taking and grading;
// no external UI dependency. Produces a transcript + assessment plan.
const ROLES = ['teacher', 'student', 'ta', 'observer'];

function session(topic, opts) {
  opts = opts || {};
  const students = (opts.students || []).map((s, i) => ({ id: 'student_' + (i + 1), name: s.name || s, role: 'student', focus: s.focus || '' }));
  return {
    ok: true, id: 'class_' + Date.now().toString(36), topic: String(topic || 'general'),
    teacher: { id: 'teacher', role: 'teacher' },
    students, turns: [], status: 'created',
    note: 'deterministic turn-taking; agent responses supplied by caller tools',
  };
}
function turn(sess, speaker, content) {
  if (!sess || !sess.students) return { ok: false, error: 'invalid classroom session' };
  const known = speaker === 'teacher' || sess.students.some((s) => s.id === speaker);
  if (!known) return { ok: false, error: 'unknown speaker: ' + speaker };
  sess.turns.push({ speaker, content: String(content || ''), at: new Date().toISOString() });
  return { ok: true, turns: sess.turns.length, next: sess.turns.length % 2 ? 'student' : 'teacher' };
}
function grade(sess, rubric) {
  const criteria = (rubric || []).map((r) => ({ name: r.name || 'criterion', weight: r.weight || 1, score: r.score || 0 }));
  const total = criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const weighted = criteria.reduce((a, c) => a + c.score * c.weight, 0) / total;
  return { ok: true, score: +weighted.toFixed(2), criteria, turns: sess ? sess.turns.length : 0 };
}

function tools() {
  return [
    { name: 'classroom_session', description: 'Create a multi-agent classroom session.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, students: { type: 'array' } }, required: ['topic'] } },
    { name: 'classroom_grade', description: 'Grade a classroom transcript against a rubric.', inputSchema: { type: 'object', properties: { rubric: { type: 'array' } } } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'classroom_session') return session(args.topic, args);
  if (name === 'classroom_turn') return turn(args.session, args.speaker, args.content);
  if (name === 'classroom_grade') return grade(args.session, args.rubric);
  if (name === 'classroom_roles') return { ok: true, roles: ROLES };
  throw new Error('unknown classroom tool: ' + name);
}
module.exports = { ROLES, session, turn, grade, tools, dispatch };
