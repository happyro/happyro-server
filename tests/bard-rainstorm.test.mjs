import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Rainstorm regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/bard-rainstorm.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/bard-rainstorm.test.mjs /tmp/bard-rainstorm-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skills/archer/severerainstorm.cpp'), 'utf8');
 const start = source.indexOf('void SkillSevereRainstormMelee::calculateSkillRatio(');
 if (start < 0) throw new Error('Missing Rainstorm production formula');
 const formula = source.slice(start);
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;
constexpr int BL_PC=1,BL_MOB=2,W_BOW=1,W_MUSICAL=2,W_WHIP=3,W_DAGGER=4;
struct status_data { int dex=600,agi=400; };
struct block_list { int type=BL_MOB,level=100;status_data status; };
struct map_session_data : block_list { struct { int weapon=W_BOW; } status;map_session_data(){type=BL_PC;} };
struct Damage { int miscflag=0; };
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<const map_session_data*>(ptr):nullptr)
#define RE_LVL_DMOD(divisor) skillratio=skillratio*src->level/(divisor)
const status_data* status_get_status_data(const block_list& src) { return &src.status; }
struct SkillSevereRainstormMelee { void calculateSkillRatio(const Damage*,const block_list*,const block_list*,uint16,int32&,int32) const; };
${formula}
int main() {
 SkillSevereRainstormMelee skill;map_session_data src;block_list target;Damage damage;
 for(int level : {100,175,250}) for(int lv=1;lv<=5;lv++) for(int weapon : {W_MUSICAL,W_WHIP,W_BOW,W_DAGGER}) {
  src.level=level;src.status.weapon=weapon;
  for(int flag : {0,4}) {
   damage.miscflag=flag;
   int ratio=100;skill.calculateSkillRatio(&damage,&src,&target,lv,ratio,flag);
   int base=100*lv+4;
   if(weapon==W_MUSICAL||weapon==W_WHIP)base+=20*lv;
   assert(ratio==base*level/100);
  }
 }
 int ratio=100;damage.miscflag=4;
 skill.calculateSkillRatio(&damage,&target,&target,5,ratio,4);
 assert(ratio==504);
 std::cout<<"PASS: Rainstorm instrument/whip bonus, bow, non-player and stale flags\\n";
}
`;
 const artifact=resolve(args[0]);
 const build=spawnSync('g++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',artifact],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr);
 const result=spawnSync(artifact,[],{encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error(`Regression failed: ${result.status??result.signal}`);
}
