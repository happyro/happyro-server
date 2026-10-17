import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO elemental summon stats regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/elemental-summon-stats.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/elemental-summon-stats.test.mjs /tmp/elemental-summon-stats')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const source = readFileSync(new URL('../src/map/elemental.cpp', import.meta.url), 'utf8');
  const fields = ['hit', 'def', 'mdef', 'flee'];
  const statements = fields.map(field => {
    const match = source.match(new RegExp(`ele\\.${field} = [^;]+;`));
    if (!match) throw new Error(`Missing summon stat: ${field}`);
    return match[0];
  }).join('\n');
  const code = `
#include <cassert>
#include <cstdint>
#include <climits>
using int64 = int64_t;
#define cap_value(a, min, max) (((a) >= (max)) ? (max) : ((a) <= (min)) ? (min) : (a))
struct Player { struct { int32_t hit,def,mdef,flee; uint16_t int_; } battle_status; struct { uint32_t base_level; } status; };
struct Stats { int16_t hit,def,mdef,flee; };
Stats calculate(Player* sd,int i) { Stats ele{}; ${statements} return ele; }
int main() {
 Player player{{250,50,30,200,120},{200}};
 auto normal=calculate(&player,3);
 assert(normal.hit==450 && normal.def==150 && normal.mdef==90 && normal.flee==300);
 player.battle_status={32760,32760,32760,32760,65535}; player.status.base_level=275;
 auto high=calculate(&player,3);
 assert(high.hit==SHRT_MAX && high.def==SHRT_MAX && high.mdef==SHRT_MAX && high.flee==SHRT_MAX);
 player.battle_status={-1000,-1000,-1000,-1000,0};
 auto low=calculate(&player,3);
 assert(low.hit==0 && low.def==0 && low.mdef==0 && low.flee==0);
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-x', 'c++', '-std=c++17', '-o', output, '-'], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr);
  const run = spawnSync(output, [], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || `Exit ${run.status}`);
  console.log('PASS: normal summon stats, upper saturation, and unsigned SQL lower bounds');
}
