import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function npc(file, internal) {
 for (const line of read(file).split('\n')) {
  const fields = line.trim().split(/\t+/);
  if (fields.length < 4 || !/^(script|duplicate\()/i.test(fields[1])) continue;
  const [display, unique] = fields[2].split('::');
  if ((unique ?? display) === internal) return { display, internal: unique ?? display };
 }
 throw new Error(`NPC not found: ${internal}`);
}
function info(npc, mode) {
 if (mode === 0) return npc.display;
 if (mode === 1) return npc.display.split('#')[0];
 if (mode === 3) return npc.internal;
 throw new Error(`Unexpected strnpcinfo mode: ${mode}`);
}

test('localized NPC events still resolve their original internal owner', () => {
 const file = 'npc/re/cities/malaya.txt';
 const script = read(file);
 const expressions = [...script.matchAll(/donpcevent strnpcinfo\((\d)\)\+"::(OnDisable|OnBingx2)"/g)];
 assert.ok(expressions.length >= 8);
 for (const internal of Array.from({ length: 11 }, (_, i) => `未确认的生物#${String(i + 1).padStart(2, '0')}`)) {
  const actor = npc(file, internal);
  assert.notEqual(actor.display, actor.internal);
  for (const expression of expressions) {
   const owner = info(actor, Number(expression[1]));
   assert.equal(npc(file, owner).internal, internal);
   assert.ok(script.includes(`${expression[2]}:`));
  }
 }
});

test('card separation and coin exchange choose by stable identity', () => {
 for (const [file, internal, expected] of [
  ['npc/re/merchants/card_separation.txt', 'Jeremy#pa0829', 'Jeremy'],
  ['npc/merchants/coin_exchange.txt', 'Merchant of Manuk', 'Merchant of Manuk']
 ]) {
  const script = read(file);
  const expression = script.match(/explode \.@npc_identity_parts\$, strnpcinfo\((\d)\), "#";/);
  assert.ok(expression);
  const actor = npc(file, internal);
  assert.notEqual(info(actor, 1), expected);
  assert.equal(info(actor, Number(expression[1])).split('#')[0], expected);
  assert.ok(script.includes(`.@npc_identity_parts$[0] == "${expected}"`));
 }
});

test('all colored pipe duplicates retain their original quest category', () => {
 const file = 'npc/re/quests/quests_rockridge.txt';
 const script = read(file);
 const expression = script.match(/explode \.@npc_identity_parts\$, strnpcinfo\((\d)\), "#"; \.@npc_name\$ = \.@npc_identity_parts\$\[0\];/);
 assert.ok(expression);
 const quests = new Map([...script.matchAll(/\.@npc_name\$ == "([^"]+)"\)\s*\.@quest_id = (\d+);/g)].map(m => [m[1], Number(m[2])]));
 let checked = 0;
 for (const line of script.split('\n')) {
  const fields = line.trim().split(/\t+/);
  if (fields.length < 4 || !/^(script|duplicate\()/i.test(fields[1])) continue;
  const [display, unique] = fields[2].split('::');
  const internal = unique ?? display;
  if (!/^(红色|蓝色|黄色|白色)管道#\d+$/.test(internal)) continue;
  const oldCategory = internal.split('#')[0];
  const actualCategory = info({ display, internal }, Number(expression[1])).split('#')[0];
  assert.equal(quests.get(actualCategory), quests.get(oldCategory));
  assert.ok(quests.get(actualCategory));
  checked++;
 }
 assert.equal(checked, 40);
});

test('self-speaker titles follow the visible name without leaking identifiers', () => {
 const file = 'npc/quests/quests_ein.txt';
 const actor = npc(file, '醉汉#ein');
 assert.notEqual(info(actor, 1), '醉汉');
 const script = read(file);
 const start = script.split('\n').findIndex(line => line.includes('::醉汉#ein\t'));
 assert.ok(start >= 0);
 const body = script.split('\n').slice(start + 1).join('\n');
 const expression = body.match(/mes "\[" \+ strnpcinfo\((\d)\) \+ "\]";/);
 assert.ok(expression);
 const title = `[${info(actor, Number(expression[1]))}]`;
 assert.equal(title, `[${actor.display.split('#')[0]}]`);
 assert.ok(!title.includes('#') && !title.includes('::'));
});

test('spaced speaker titles use the actor name and retain their padding', () => {
 const file = 'npc/quests/newgears/2004_headgears.txt';
 const actor = npc(file, '塞斯#1');
 const expression = read(file).split('\n').find(line => line.includes('mes " [" + strnpcinfo('));
 assert.ok(expression);
 const mode = Number(expression.match(/strnpcinfo\((\d)\)/)[1]);
 assert.equal(` [${info(actor, mode)}]`, ' [善司]');
 const illusion = read('npc/re/quests/quests_illusion_dungeons.txt');
 assert.ok(illusion.includes('mes "[ " + strnpcinfo(1) + " ]";'));
 // Other speakers in the same scenes must retain their own identity.
 assert.ok(illusion.includes('mes "[ 山裕 ]";'));
});

test('joint game announcements preserve the player and chosen hand', () => {
 const file = 'npc/re/quests/quests_malangdo.txt';
 const source = read(file);
 for (const [internal, expected] of [['塞尔#gamer', '赛勒'], ['帕阿#gamer', '鲍尔']]) {
  const actor = npc(file, internal);
  const start = source.indexOf(`::${internal}\t`);
  const body = source.slice(start, source.indexOf('\n}', start));
  assert.ok(body.includes('mes "[" + strnpcinfo(1) + " & "+strcharinfo(0)+"]";'));
  assert.ok(body.includes('mes "[" + strnpcinfo(1) + "] "+.@rps$[.@npc];'));
  assert.equal(`[${info(actor, 1)} & 罗安]`, `[${expected} & 罗安]`);
  assert.equal(`[${info(actor, 1)}] 石头`, `[${expected}] 石头`);
 }
});

test('shared family dialogue keeps three distinct named speakers', () => {
 const file = 'npc/quests/quests_comodo.txt';
 const source = read(file);
 const start = source.indexOf('::CmdFamily\t');
 const body = source.slice(start, source.indexOf('\n}', start));
 const speakers = [...body.matchAll(/mes "\[([^\]]+)\]";/g)].map(match => match[1]);
 assert.deepEqual(speakers, ['烤肉小朋友', '烤肉母亲', '烤肉父亲', '烤肉小朋友', '烤肉母亲', '烤肉小朋友']);
 for (const internal of ['CmdFamily', '烧烤妈妈#cmd', '烧烤男孩#cmd2']) {
  assert.ok(speakers.includes(info(npc(file, internal), 1)));
 }
 assert.ok(!body.includes('strnpcinfo(1)'));
});
