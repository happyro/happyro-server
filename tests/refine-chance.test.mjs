import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2), plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color'), output = options[0];
if (!output || output === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO refinement chance regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/refine-chance.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/refine-chance.test.mjs /tmp/happyro-refine-test')}\n`);
} else {
 if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = file => readFileSync(resolve(root, file), 'utf8');
 const source = read('src/map/status.cpp');
 const start = source.indexOf('int32 status_get_refine_chance(');
 const end = source.indexOf('\n}', start) + 2;
 if (start < 0 || end < start) throw new Error('Missing chance implementation');
 // Verify all supported entry points use the same calculation, and 0% cannot pass on roll zero.
 for (const [file, needle] of [
  ['src/map/clif.cpp','status_get_refine_chance(cost->chance) );'],
  ['src/map/clif.cpp','status_get_refine_chance(cost->chance) > ( rnd() % 100 )'],
  ['src/map/script.cpp','script_pushint( st, status_get_refine_chance(cost->chance) );'],
  ['src/map/skill.cpp','per = status_get_refine_chance(per * 100);']
 ]) if (!read(file).includes(needle)) throw new Error(`Missing shared chance integration: ${file}`);
 const code = `
#include <cassert>
#include <cstdint>
#include <algorithm>
#include <iostream>
using int32=int32_t;using int64=int64_t;
#define cap_value(value,lo,hi) std::clamp<int64>(value,lo,hi)
struct {int32 refine_chance_rate=100,refine_always_success=0;} battle_config;
${source.slice(start,end)}
int main(){
 for(int chance:{0,500,1700,6000,10000})assert(status_get_refine_chance(chance)==chance/100);
 battle_config.refine_chance_rate=200;
 assert(status_get_refine_chance(1700)==34);assert(status_get_refine_chance(6000)==100);
 battle_config.refine_chance_rate=250;assert(status_get_refine_chance(1700)==42);
 battle_config.refine_chance_rate=1000000;assert(status_get_refine_chance(10000)==100);
 assert(status_get_refine_chance(0)==0);
 battle_config.refine_chance_rate=0;assert(status_get_refine_chance(10000)==0);
 battle_config.refine_always_success=1;
 for(int chance:{-1000,0,500,10000})assert(status_get_refine_chance(chance)==100);
 battle_config.refine_always_success=0;battle_config.refine_chance_rate=100;
 assert(status_get_refine_chance(1700)==17);
 for(int roll=0;roll<100;roll++){
  assert(!(status_get_refine_chance(0)>roll));assert(status_get_refine_chance(10000)>roll);
 }
 std::cout<<"Refinement defaults, fractional multiplier, cap, guaranteed override, restoration and roll boundaries passed\\n";
}
`;
 const build=spawnSync('g++',['-O2','-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',resolve(output)],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(resolve(output),[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
