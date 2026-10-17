import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Devotion inheritance regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/devotion-inheritance.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/devotion-inheritance.test.mjs /tmp/devotion-inheritance-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
 const slice = (first,last,from=0) => {
  const start=source.indexOf(first,from),end=source.indexOf(last,start);
  if(start<0||end<0)throw new Error(`Missing production branch: ${first}`);
  return source.slice(start,end);
 };
 const devotion=slice('case SC_DEVOTION:', 'case SC_COMA:');
 const defense=slice('case SC_AUTOGUARD:', 'case SC_TENSIONRELAX:');
 const code = `
#include <cassert>
#include <cstdint>
#include <map>
#include <iostream>
using int32=int32_t;using t_tick=int64_t;
enum sc_type { SC_AUTOGUARD,SC_DEFENDER,SC_REFLECTSHIELD,SC_ENDURE,SC_DEVOTION };
constexpr int SCSTART_NOAVOID=1,SCSTART_NOICON=2,BL_PC=1,BL_MER=2,MAX_DEVOTION=5,MF_BATTLEGROUND=2;
struct Entry{int val1=0,val2=0,val3=0,val4=0;};
using status_change_entry=Entry;
struct status_change{std::map<sc_type,Entry> entries;bool empty(){return entries.empty();}Entry*getSCE(sc_type t){return entries.count(t)?&entries.at(t):nullptr;}};
struct block_list{int id=0,type=BL_PC,m=0;status_change sc;};
struct map_session_data:block_list{int devotion[MAX_DEVOTION]={};};
struct TBL_MER:block_list{bool devotion_flag=false;map_session_data*master=nullptr;};
std::map<int,block_list*> actors;
block_list*map_id2bl(int id){return actors.count(id)?actors.at(id):nullptr;}
map_session_data*map_id2sd(int id){return static_cast<map_session_data*>(map_id2bl(id));}
status_change*status_get_sc(block_list*b){return &b->sc;}
bool map_flag_gvg2(int m){return m==1;}bool map_getmapflag(int m,int f){return m==f;}
struct {int getSkill(sc_type t){return t;}}status_db;
int skill_get_time(int,int){return 10000;}
bool status_change_start(block_list*,block_list*,sc_type,int,int,int,int,int,t_tick,int);
bool status_change_start(block_list*src,block_list*bl,sc_type type,int,int val1,int val2,int val3,int val4,t_tick tick,int flag){
 auto*sd=bl->type==BL_PC?static_cast<map_session_data*>(bl):nullptr;
 switch(type){${defense}${devotion}default:break;}
 bl->sc.entries[type]={val1,val2,val3,val4};return true;
}
void cast_defense(map_session_data&caster,sc_type t,int level){status_change_start(&caster,&caster,t,10000,level,0,0,0,10000,0);}
void devote(map_session_data&caster,map_session_data&ally){caster.devotion[0]=ally.id;status_change_start(&caster,&ally,SC_DEVOTION,10000,caster.id,0,10,0,10000,0);}
int main(){
 for(int level=1;level<=10;level++)for(int mode:{0,1,2}){
  map_session_data caster,first,second;caster.id=1;first.id=2;second.id=3;first.m=second.m=mode;actors={{1,&caster},{2,&first},{3,&second}};
  cast_defense(caster,SC_AUTOGUARD,level);
  cast_defense(caster,SC_DEFENDER,std::min(level,5));
  caster.sc.entries[SC_REFLECTSHIELD]={5,25,0,0};caster.sc.entries[SC_ENDURE]={5,7,0,0};
  devote(caster,first);
  auto guard=caster.sc.entries.at(SC_AUTOGUARD),defender=caster.sc.entries.at(SC_DEFENDER);
  assert(first.sc.entries.at(SC_AUTOGUARD).val2==guard.val2);
  assert(first.sc.entries.at(SC_DEFENDER).val2==defender.val2);
  assert(first.sc.entries.at(SC_DEFENDER).val4==defender.val4);
  assert(first.sc.entries.at(SC_REFLECTSHIELD).val4==1);
  assert(first.sc.entries.count(SC_ENDURE)==(mode==0?1u:0u));
  caster.sc.entries.clear();caster.devotion[0]=0;devote(caster,second);
  assert(!second.sc.entries.count(SC_AUTOGUARD)&&!second.sc.entries.count(SC_DEFENDER));
  cast_defense(caster,SC_AUTOGUARD,level);cast_defense(caster,SC_DEFENDER,std::min(level,5));
  assert(second.sc.entries.at(SC_AUTOGUARD).val2==guard.val2);
  assert(second.sc.entries.at(SC_DEFENDER).val2==defender.val2);
  assert(second.sc.entries.at(SC_DEFENDER).val4==defender.val4);
 }
 std::cout<<"Devotion defense order, levels, reduction, ASPD and map restrictions passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
