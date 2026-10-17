import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Wizard cast regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/wizard-cast.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/wizard-cast.test.mjs /tmp/wizard-cast-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
 const marker = '// Multiplicative Fixed CastTime values';
 const start = source.indexOf(marker);
 const end = source.indexOf('if (sc->getSCE(SC_DANCEWITHWUG))', start);
 if(start<0 || end<0)throw new Error('Fixed cast modifiers missing');
 const code = `
#include <cassert>
#include <cstdint>
#include <algorithm>
#include <iostream>
using uint16=uint16_t;using std::max;
constexpr int SC_SECRAMENT=1,WL_RADIUS=2,WL_WHITEIMPRISON=10,WL_FREEZE_SP=50;
struct Entry {int val2;};struct state {Entry* getSCE(int){return nullptr;}};
struct actor {int radius;};
int pc_checkskill(actor* a,int){return a->radius;}
int status_get_int(actor*){return 100;}int status_get_lv(actor*){return 200;}
void check(int skill_id,uint16 skill_lv,int radius,bool player){
 actor a{radius};auto*bl=&a;auto*sd=player?&a:nullptr;state state;auto*sc=&state;
 int fixcast_r=0;auto level_before=skill_lv;
 ${source.slice(start,end)}
 assert(skill_lv==level_before);
 assert(fixcast_r==(player&&radius&&skill_id>=10&&skill_id<=50 ? 20+radius*5 : 0));
}
int main(){for(bool player:{false,true})for(int radius=0;radius<=3;radius++)for(int id:{1,10,30,50,60})for(int lv=1;lv<=10;lv++)check(id,lv,radius,player);
 std::cout<<"Radius keeps the cast level and only modifies Warlock fixed cast time\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
