import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const script = fs.readFileSync(new URL('../npc/re/jobs/2e/kagerou_oboro.txt', import.meta.url), 'utf8');
const guard = script.match(/L_CheckJobReward:\s*([\s\S]*?)\n\treturn;/)?.[1];
assert.ok(guard, 'the final advancement guard exists');
const calls = [...script.matchAll(/callsub L_CheckJobReward\s*([^;]*);/g)];
assert.equal(calls.length, 2, 'check both before the ceremony and immediately before advancement');

// Execute the production guard, removing only dialogue commands. Per
// buildin_callsub in script.cpp, the callee has a fresh .@ scope; values from
// the caller are available only through explicit arguments/getarg.
const localVariables = source => source.replace(/\.@(\w+)/g, 'locals.$1');
const evaluate = new Function('locals', 'getarg', 'checkweight', 'ismounting',
  'Class', 'Job_Ninja', 'BaseLevel', 'JobLevel', 'SkillPoint',
  localVariables(guard)
    .replace(/^\s*mes .*;\s*$/gm, '')
    .replace(/^\s*cutin .*;\s*$/gm, '')
    .replace(/\bclose2;/g, '')
    .replace(/\bend;/g, 'throw new Error("advancement denied");'));

function check(call, reward, { capacity = true, job = 25, base = 99, level = 70, points = 0, riding = false } = {}) {
  const locals = new Proxy({}, { get: (target, key) => target[key] ?? 0 });
  const caller = { item: reward };
  const args = call[1].trim()
    ? new Function('locals', `return [${localVariables(call[1].replace(/^\s*,/, ''))}];`)(caller)
    : [];
  const weights = [];
  let allowed = true;
  try {
    evaluate(locals, index => {
      assert.ok(index < args.length, 'callee argument must be supplied');
      return args[index];
    }, (id, amount) => {
      weights.push([id, amount]);
      return id === reward && capacity;
    }, () => riding, job, 25, base, level, points);
  } catch (error) {
    if (error.message !== 'advancement denied') throw error;
    allowed = false;
  }
  return { allowed, weights };
}

for (const [route, reward] of [['dagger', 13075], ['huuma', 13311]]) {
  test(`${route}: both advancement checks receive the actual reward in a fresh scope`, () => {
    for (const call of calls) {
      assert.deepEqual(check(call, reward), { allowed: true, weights: [[reward, 1]] });
      assert.deepEqual(check(call, reward, { capacity: false }), { allowed: false, weights: [[reward, 1]] });
    }
  });
}

test('both checks reject changed job, levels, unused skills and riding before checking capacity', () => {
  for (const call of calls) {
    for (const player of [{ job: 1 }, { base: 98 }, { level: 69 }, { points: 1 }, { riding: true }]) {
      assert.deepEqual(check(call, 13075, player), { allowed: false, weights: [] });
    }
  }
});
