import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Knight resource regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/knight-resource.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/knight-resource.test.mjs /tmp/knight-resource-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const battle=readFileSync(resolve(root,'src/map/battle.cpp'),'utf8');
 const start=battle.indexOf('int32 damagevalue = (sstatus->hp / 50');
 const wideStart=battle.indexOf('int64 damagevalue = (static_cast<int64>(sstatus->hp) / 50');
 const pos=start>=0?start:wideStart;
 if(pos<0)throw new Error('Missing dragon breath formula');
 const formula=battle.slice(pos,battle.indexOf('ATK_ADD(',pos));
 const status=readFileSync(resolve(root,'src/map/status.cpp'),'utf8');
 const refresh=status.match(/status_heal\(bl, (.*), 0, 1\);\n\s*status_change_clear_buffs\(bl, SCCB_REFRESH\)/)?.[1];
 const berserk=status.match(/sce->val2 = (.*);\n\s*break;\n\s*case SC_RUN:/)?.[1];
 if(!refresh||!berserk)throw new Error('Missing rune/Frenzy HP formula');
 const code=`
#include <cassert>
#include <cstdint>
#include <iostream>
using int32=int32_t;using int64=int64_t;using uint16=uint16_t;
constexpr int DK_DRAGONIC_AURA=1,RK_DRAGONTRAINING=2,SC_DRAGONIC_AURA=3;
struct status_data { uint32_t hp,max_hp,max_sp;int pow; };
struct block_list { status_data stats;int level; };
struct map_session_data:block_list { int aura,training; };
struct Entry { int val1; };
struct status_change { Entry entry{2};bool active=false;const Entry* getSCE(int)const{return active?&entry:nullptr;} };
int pc_checkskill(const map_session_data*sd,int skill){return skill==DK_DRAGONIC_AURA?sd->aura:sd->training;}
uint32_t status_get_max_sp(const block_list*bl){return bl->stats.max_sp;}
uint32_t status_get_max_hp(const block_list*bl){return bl->stats.max_hp;}
int status_get_lv(const block_list*bl){return bl->level;}
int64 damage(map_session_data* sd,status_change* sc,int skill_lv){auto*src=sd;auto*sstatus=&sd->stats;${formula}return damagevalue;}
int64 heal(block_list*bl){return ${refresh};}
int64 penalty(status_data*status){return ${berserk};}
int main(){
 for(uint32_t resource:{1000u,1100000u,200000000u,4294967295u}) {
  block_list b{{resource,resource,resource,0},250};
  assert(heal(&b)==int64(resource)*25/100);
  assert(penalty(&b.stats)==int64(resource)*5/100);
  for(int lv=1;lv<=10;lv++)for(int level:{99,100,175,250})for(int pow:{0,32767})for(bool aura:{false,true}){
   map_session_data sd;sd.stats={resource,resource,resource,pow};sd.level=level;sd.aura=1;sd.training=5;
   status_change sc;sc.active=aura;
   int64 expected=(int64(resource)/50+int64(resource)/4)*lv;
   if(level>100)expected=expected*level/100;
   expected=expected*(140+pow/5)/100;
   if(aura)expected+=expected*20/100;
   assert(damage(&sd,&sc,lv)==expected);
  }
 }
 std::cout<<"PASS: dragon breath, Refresh and Frenzy preserve wide HP/SP arithmetic\\n";
}
`;
 const artifact=resolve(args[0]);
 const build=spawnSync('g++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',artifact],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr);
 const result=spawnSync(artifact,[],{encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error(`Regression failed: ${result.status??result.signal}`);
}
