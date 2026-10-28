import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../npc/guild2/agit_start_se.txt', import.meta.url), 'utf8');
// Execute the script's time predicates at schedule boundaries and through
// the clock events actually registered, including startup-time decisions.
const predicates = [...source.matchAll(/if\s*\(([^{}]+)\)\s*\{/g)]
 .map(m => m[1]).filter(s => s.includes('gettime'));
const clocks = new Set([...source.matchAll(/OnClock(\d{2})(\d{2}):/g)].map(m => +m[1] * 60 + +m[2]));
function decisions(day, minute) {
 const ctx = { DT_DAYOFWEEK: 0, DT_HOUR: 1, TUESDAY: 2, THURSDAY: 4, SATURDAY: 6,
 gettime: k => k === 0 ? day : Math.floor(minute / 60) };
 return predicates.map(p => vm.runInNewContext(p, ctx));
}
test('SE starts and ends at its documented times on every scheduled day', () => {
 for (const [day,start,end] of [[2,18,20],[4,18,20],[6,21,23]]) {
  assert(clocks.has(start*60)); assert(clocks.has(end*60));
  assert.equal(decisions(day,start*60-1)[0],false);
  assert.equal(decisions(day,start*60)[0],true);
  assert.equal(decisions(day,end*60-1)[0],true);
  assert.deepEqual(decisions(day,end*60),[false,true]);
  let active=false;
  for (const minute of [...clocks].sort((a,b)=>a-b)) {
   const [begin,finish]=decisions(day,minute);
   if(begin) active=true; else if(finish) active=false;
  }
  assert.equal(active,false,`day ${day} must not remain active after its final clock event`);
 }
});
test('unscheduled days do not automatically start SE', () => {
 for(const day of [0,1,3,5]) for(const minute of clocks) assert.equal(decisions(day,minute)[0],false);
});
