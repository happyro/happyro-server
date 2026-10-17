import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Tetra Vortex sequence regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/tetra-sequence.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/tetra-sequence.test.mjs /tmp/tetra-sequence-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skills/mage/tetravortex.cpp'), 'utf8');
 const classes = ['SkillTetraVortex','SkillTetraVortexEarth','SkillTetraVortexFire','SkillTetraVortexWater','SkillTetraVortexWind'];
 const methods = classes.map(name => {
  const start = source.indexOf('void '+name+'::castendDamageId(');
  if(start<0)throw new Error('Missing '+name);
  let end=source.indexOf('{',start),depth=1;
  while(depth){end++;if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
  return source.slice(start,end+1);
 });
 const code = `
#include <cassert>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <vector>
using int32=int32_t;using uint16=uint16_t;using uint8=uint8_t;using t_tick=int64_t;using sc_type=int;
constexpr int SC_SPHERE_1=1,SC_SPHERE_2=2,SC_SPHERE_3=3,SC_SPHERE_4=4,SC_SPHERE_5=5;
constexpr int WLS_FIRE=1,WLS_WIND=2,WLS_WATER=3,WLS_STONE=4;
constexpr int WL_TETRAVORTEX_FIRE=10,WL_TETRAVORTEX_WIND=11,WL_TETRAVORTEX_WATER=12,WL_TETRAVORTEX_GROUND=13;
constexpr int BL_PC=1,BL_CHAR=2,BCT_ENEMY=4,skill_area_sub=0,skill_castend_damage_id=0;
struct Entry{int val1=1;};struct status_change{bool active[6]{};Entry data[6];Entry* getSCE(int i){return active[i]?&data[i]:nullptr;}};
struct block_list{bool player=true;int id=1;status_change sc;};using map_session_data=block_list;
#define BL_CAST(t,b) ((b)->player?(b):nullptr)
status_change* status_get_sc(block_list* b){return &b->sc;}
void status_change_end(block_list*b,int i){b->sc.active[i]=false;}
int skill_get_splash(int,int){return 3;}
int skill_area_temp[6]{};
struct Hit{t_tick tick;int target,element,type;};std::vector<Hit> hits;
void skill_addtimerskill(block_list*,t_tick tick,int target,int,int,int element,uint16,int type,int){hits.push_back({tick,target,element,type});}
void map_foreachinallrange(int,block_list*,int,int,block_list*,int,uint16,t_tick,int,int);
${classes.map((n,i)=>`struct ${n}{int getSkillId()const{return ${[20,13,10,12,11][i]};}void castendDamageId(block_list*,block_list*,uint16,t_tick,int32&)const;};`).join('\n')}
${methods.join('\n')}
void map_foreachinallrange(int,block_list*,int,int,block_list*src,int skill,uint16 level,t_tick tick,int flag,int){
 for(int id:{2,3}){block_list target;target.id=id;
 switch(skill){
 case WL_TETRAVORTEX_FIRE:SkillTetraVortexFire{}.castendDamageId(src,&target,level,tick,flag);break;
 case WL_TETRAVORTEX_WIND:SkillTetraVortexWind{}.castendDamageId(src,&target,level,tick,flag);break;
 case WL_TETRAVORTEX_WATER:SkillTetraVortexWater{}.castendDamageId(src,&target,level,tick,flag);break;
 case WL_TETRAVORTEX_GROUND:SkillTetraVortexEarth{}.castendDamageId(src,&target,level,tick,flag);break;
 }}
}
int main(){
 for(bool player:{false,true})for(int level:{1,5,6,10})for(int absent=0;absent<=5;absent++){
  block_list src,target;src.player=player;target.id=2;
  for(int i=1;i<=5;i++){src.sc.active[i]=i!=absent;src.sc.data[i].val1=1+(i-1)%4;}
  std::vector<int> expected;
  if(player){for(int i=5;i>=1;i--)if(src.sc.active[i] && !(absent==0 && i==1))expected.push_back(9+src.sc.data[i].val1);}
  else expected={10,11,12,13};
  hits.clear();int flag=0;SkillTetraVortex{}.castendDamageId(&src,&target,level,1000,flag);
  const int targets=level>5?2:1;assert(hits.size()==size_t(4*targets));
  for(int n=0;n<4;n++)for(int t=0;t<targets;t++){
   const auto&hit=hits[n*targets+t];assert(hit.tick==1000+n*200);assert(hit.type==n);assert(hit.target==2+t);assert(hit.element==expected[n]);
  }
  if(player)for(int i=1;i<=5;i++)assert(!src.sc.active[i]);
 }
 std::cout<<"Tetra Vortex four/five spheres, sparse slots, single/AoE and monster sequences passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
