import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Knight servant ammunition regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/knight-ammunition.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/knight-ammunition.test.mjs /tmp/knight-ammunition-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = file => readFileSync(resolve(root, file), 'utf8');
 function extract(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing ${signature}`);
  const body = source.indexOf('{', start);
  let depth = 1, end = body + 1;
  while (depth && end < source.length) {
   if (source[end] === '{') depth++;
   if (source[end] === '}') depth--;
   end++;
  }
  if (depth) throw new Error(`Unclosed ${signature}`);
  return source.slice(start, end);
 }
 const skill=read('src/map/skill.cpp');
 const snapshot=extract(skill,'if (skill_id == DK_SERVANT_W_PHANTOM || skill_id == DK_SERVANT_W_DEMOL)');
 const consumeStart=skill.indexOf('case DK_SERVANT_W_SIGN:',skill.indexOf('void skill_consume_requirement('));
 const consume=skill.slice(consumeStart,skill.indexOf('break;',consumeStart)+6);
 const beginStart=skill.indexOf('case DK_SERVANT_W_PHANTOM:',skill.indexOf('bool skill_check_condition_castbegin('));
 const begin=skill.slice(beginStart,skill.indexOf('break;',beginStart)+6);
 const methods=['servantweaponphantom','servantweapondemolition'].map((name,i)=>extract(read('src/map/skills/swordman/'+name+'.cpp'),'void '+['SkillServantWeaponPhantom','SkillServantWeaponDemolition'][i]+'::modifyDamageData(')).join('\n');
 const remove=extract(read('src/map/pc.cpp'),'void pc_delservantball(');
 const code=`
#include <cassert>
#include <cstdint>
#include <algorithm>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;using std::min;
constexpr int BL_PC=1,BL_MOB=2,MAX_SERVANTBALL=5,DK_SERVANT_W_SIGN=1,DK_SERVANT_W_PHANTOM=2,DK_SERVANT_W_DEMOL=3;
struct block_list {int type=BL_MOB;};
struct map_session_data:block_list {int servantball=0,servantball_old=0;map_session_data(){type=BL_PC;}};
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<const map_session_data*>(ptr):nullptr)
struct Damage {int div_=5;};
struct Requirement{int spiritball=5;};
struct SkillServantWeaponPhantom{void modifyDamageData(Damage&,const block_list&,const block_list&,uint16)const;};
struct SkillServantWeaponDemolition{void modifyDamageData(Damage&,const block_list&,const block_list&,uint16)const;};
int cap_value(int n,int low,int high){return std::clamp(n,low,high);}
void clif_servantball(map_session_data&){}
${remove}
${methods}
void castBegin(map_session_data& sd,int type){Requirement require;switch(type){${begin}}}
void consume(map_session_data* sd,int type,bool free=false){Requirement require;if(free)require.spiritball=0;int skill_id=type;${snapshot}if(require.spiritball>0)switch(type){${consume}}}
int main(){
 SkillServantWeaponPhantom phantom;SkillServantWeaponDemolition demol;block_list target;
 for(int type:{DK_SERVANT_W_PHANTOM,DK_SERVANT_W_DEMOL})for(int before=0;before<=5;before++)for(int atCast=0;atCast<=5;atCast++){
  if(type==DK_SERVANT_W_DEMOL&&before==0)continue; // Normal begin rejects zero.
  for(bool free:{false,true}){
   map_session_data sd;sd.servantball=before;castBegin(sd,type);
   sd.servantball=atCast;consume(&sd,type,free);
   assert(sd.servantball==(free?atCast:0));
   // AOE recovery / later resource changes must not change this cast's hit count.
   for(int recovered=0;recovered<=5;recovered++){
    sd.servantball=recovered;Damage d;
    if(type==DK_SERVANT_W_PHANTOM)phantom.modifyDamageData(d,sd,target,5);else demol.modifyDamageData(d,sd,target,5);
    assert(d.div_==atCast);
   }
  }
 }
 Damage npc;phantom.modifyDamageData(npc,target,target,5);assert(npc.div_==5);
 std::cout<<"PASS: servant attacks use cast-time ammunition across regeneration and AOE targets\\n";
}
`;
 const artifact = resolve(args[0]);
 const build = spawnSync('g++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', artifact], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr);
 const result = spawnSync(artifact, [], { encoding: 'utf8' });
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if (result.status !== 0) throw new Error(`Regression failed: ${result.status ?? result.signal}`);
}
