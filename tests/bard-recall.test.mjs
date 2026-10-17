import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Bard recall regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/bard-recall.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/bard-recall.test.mjs /tmp/bard-recall-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const names = ['encore', 'retrospection'];
 const methods = names.map(name => readFileSync(resolve(root, `src/map/skills/archer/${name}.cpp`), 'utf8').split('\n').filter(line => !line.startsWith('#include')).join('\n')).join('\n');
 const code = `
#include <cassert>
#include <cstdint>
#include <algorithm>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;using t_tick=int64_t;using std::min;
constexpr int BL_PC=1,BL_MOB=2,BD_ENCORE=10,TR_RETROSPECTION=11;
struct block_list { int type=BL_MOB,id=1; };
struct map_session_data : block_list { uint16 skill_id_dance=100,skill_id_song=101,skill_lv_dance=10,skill_lv_song=10,learned=10;map_session_data(){type=BL_PC;} };
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<map_session_data*>(ptr):nullptr)
struct SkillImpl { int id;SkillImpl(int id):id(id){}int getSkillId() const {return id;} };
struct SkillEncore:SkillImpl { SkillEncore();void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
struct SkillRetrospection:SkillImpl { SkillRetrospection();void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
int sent=0,failed=0,called=0,last_lv=0,last_id=0;
uint16 pc_checkskill(map_session_data* sd,uint16 id){return id?sd->learned:0;}
void clif_skill_nodamage(block_list*,block_list&,int,uint16){sent++;}
void clif_skill_fail(map_session_data&,int){failed++;}
int unit_skilluse_id(block_list*,int,uint16 id,uint16 lv){called++;last_id=id;last_lv=lv;return 1;}
${methods}
int main(){
 SkillEncore encore;SkillRetrospection retro;map_session_data sd;int32 flag=0;
 for(int which:{0,1}) for(int old:{10,5,1}) for(int learned:{1,3,10,0}) {
  sd.skill_lv_dance=sd.skill_lv_song=old;sd.learned=learned;sent=failed=called=0;
  if(which)retro.castendNoDamageId(&sd,&sd,1,0,flag);else encore.castendNoDamageId(&sd,&sd,1,0,flag);
  if(!learned){assert(called==0&&sent==0&&failed==1);}
  else {assert(called==1&&sent==1&&failed==0);assert(last_lv==std::min(old,learned));assert(last_id==(which?101:100));}
 }
 std::cout<<"PASS: Encore/Retrospection recheck current learned level\\n";
}
`;
 const artifact=resolve(args[0]);
 const build=spawnSync('g++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',artifact],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr);
 const result=spawnSync(artifact,[],{encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error(`Regression failed: ${result.status??result.signal}`);
}
