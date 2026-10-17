import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Warp menu regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/warp-menu.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/warp-menu.test.mjs /tmp/warp-menu-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
 const clif = readFileSync(resolve(root, 'src/map/clif.cpp'), 'utf8');
 const start = source.indexOf('int32 skill_castend_map (');
 const end = source.indexOf('static bool skill_dance_switch', start);
 const menuStart = clif.indexOf('\tsd.menuskill_id = skill_id;', clif.indexOf('void clif_skill_warppoint('));
 const menuEnd = clif.indexOf('\n}', menuStart);
 if([start,end,menuStart,menuEnd].some(x=>x<0))throw new Error('Warp methods missing');
 const code = `
#include <cassert>
#include <cstdint>
#include <cstring>
#include <memory>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;using int16=int16_t;
constexpr int AL_WARP=1,AL_TELEPORT=2,ALL_ODINS_RECALL=3,BL_PC=1,CLR_TELEPORT=1,WIP_DISABLE_ALL=1;
struct s_point_str{char map[16];int x,y;};struct s_skill_unit_group{int val1=8,val2=0,val3=0;};
struct map_session_data{void*prev=this;bool dead=false;int id=1,menuskill_id=0,menuskill_val=0,menuskill_val2=0,skillitem=0,skillitemlv=0,skillitem_keep_requirement=0,learned=4;
 struct{struct{bool cast=false;}cant;}sc;
 struct{int skillx=111,skilly=222;}ud;
 struct{int workinprogress=0;}state;
 struct{s_point_str save_point{"save",10,20};s_point_str memo_point[3]={{"memo1",30,40},{"memo2",50,60},{"memo3",70,80}};}status;
};
struct{int skill_log=0;}battle_config;
#define nullpo_ret(sd) if(!(sd))return 0
#define clif_menuskill_clear(sd) (sd)->menuskill_id=(sd)->menuskill_val=(sd)->menuskill_val2=0
#define ARR_FIND(start,end,i,cond) for(i=start;i<end;i++)if(cond)break
void ShowInfo(const char*,...){ }
bool pc_isdead(map_session_data*sd){return sd->dead;}
void unit_stop_attack(map_session_data*){}
int randomwarps=0,savedwarps=0;
void pc_randomwarp(map_session_data*,int){randomwarps++;}
void pc_setpos(map_session_data*,int,int,int,int){savedwarps++;}
void clif_refresh_storagewindow(map_session_data*){}
int mapindex_name2id(const char*name){return strcmp(name,"bad")==0?0:1;}
int failures=0,consumed=0,created=0,countLevel=0;
void clif_skill_fail(map_session_data&,int){failures++;}
int pc_checkskill(map_session_data*sd,int){return sd->learned;}
int skill_get_maxcount(int,int level){countLevel=level;return 3;}
void unit_skillunit_maxcount(decltype(map_session_data::ud)&,int,int&){}
bool canConsume=true;
bool skill_check_condition_castend(map_session_data&,int,int){return canConsume;}
void skill_consume_requirement(map_session_data*,int,int level,int){consumed=level;}
std::shared_ptr<s_skill_unit_group> skill_unitsetting(map_session_data*,int,int level,int x,int y,int){created=level;assert(x==111&&y==222);return std::make_shared<s_skill_unit_group>();}
void openMenu(map_session_data& sd,uint16 skill_id,uint16 skill_lv){${clif.slice(menuStart,menuEnd)}}
${source.slice(start,end)}
void reset(){failures=consumed=created=countLevel=0;canConsume=true;}
void cleared(const map_session_data&sd){assert(sd.menuskill_id==0&&sd.menuskill_val==0&&sd.menuskill_val2==0);}
int main(){
 for(int level=1;level<=4;level++){
  reset();map_session_data sd;openMenu(sd,AL_WARP,level);skill_castend_map(&sd,AL_WARP,"save");
  assert(created==level && consumed==level && countLevel==level);cleared(sd);
 }
 for(const char* dest:{"memo1","memo2","memo3"}){
  reset();map_session_data sd;openMenu(sd,AL_WARP,1);skill_castend_map(&sd,AL_WARP,dest);assert(!created&&!consumed);cleared(sd);
 }
 for(int scenario=0;scenario<6;scenario++){
  reset();map_session_data sd;openMenu(sd,AL_WARP,4);
  if(scenario==0)sd.learned=0;
  if(scenario==1)sd.learned=2;
  if(scenario==2)sd.dead=true;
  if(scenario==3)sd.sc.cant.cast=true;
  if(scenario==4)canConsume=false;
  skill_castend_map(&sd,AL_WARP,scenario==5?"cancel":"save");assert(!created&&!consumed);cleared(sd);
 }
 reset();map_session_data item;item.learned=0;item.skillitem=AL_WARP;item.skillitemlv=3;openMenu(item,AL_WARP,3);
 skill_castend_map(&item,AL_WARP,"memo2");assert(created==3&&consumed==3);cleared(item);
 map_session_data tp;openMenu(tp,AL_TELEPORT,1);skill_castend_map(&tp,AL_TELEPORT,"Random");assert(randomwarps==1);cleared(tp);
 openMenu(tp,AL_TELEPORT,2);skill_castend_map(&tp,AL_TELEPORT,"save");assert(savedwarps==1);cleared(tp);
 std::cout<<"Warp selected levels, destinations, skill reset, cancellation, items and Teleport passed\\n";
}
`;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',output],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr||'Compiler failed');
 const run=spawnSync(output,[],{encoding:'utf8'});
 if(run.status!==0)throw new Error(run.stderr||'Regression failed');
 process.stdout.write(run.stdout);
}
