import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Shield Chain ratio regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/shield-chain.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/shield-chain.test.mjs /tmp/shield-chain-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source=readFileSync(resolve(root,'src/map/skills/swordman/shieldchain.cpp'),'utf8');
 const start=source.indexOf('void SkillShieldChain::calculateSkillRatio(');
 if(start<0)throw new Error('Shield Chain ratio missing');
 const config=readFileSync(resolve(root,'src/config/const.hpp'),'utf8');
 const macro=config.slice(config.indexOf('#define RE_LVL_DMOD(val)'),config.indexOf('#define RE_LVL_MDMOD(val)'));
 const code=`
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <iostream>
#define RENEWAL
using int32=int32_t;using int64=int64_t;using int16=int16_t;using uint16=uint16_t;
constexpr int SC_SHIELD_POWER=1,EQI_HAND_L=0,IT_ARMOR=1,IG_SHIELD_MASTERY=1,BL_PC=1;
struct Damage{};
struct status_change{bool powered=false;bool getSCE(int)const{return powered;}};
struct block_list{int type=0,level=100;status_change sc;};
struct Item{int type=IT_ARMOR,weight=1500;};
struct map_session_data:block_list{int equip_index[1]={-1};Item*inventory_data[1]={};int mastery=0;struct{struct{struct{int refine=0;}items_inventory[1];}u;}inventory;};
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<const map_session_data*>(ptr):nullptr)
const status_change*status_get_sc(const block_list*b){return &b->sc;}
int status_get_lv(const block_list*b){return b->level;}
int pc_checkskill(const map_session_data*sd,int){return sd?sd->mastery:0;}
int64 cap_value(int64 n,int64 lo,int64 hi){return std::clamp(n,lo,hi);}
${macro}
struct SkillShieldChain{void calculateSkillRatio(const Damage*,const block_list*,const block_list*,uint16,int32&,int32)const;};
${source.slice(start)}
int main(){
 for(int level=1;level<=5;level++)for(int base:{100,150,200})for(int charlevel:{99,100,250})for(bool shield:{false,true})for(bool powered:{false,true}){
  map_session_data caster;caster.type=BL_PC;caster.level=charlevel;caster.sc.powered=powered;caster.mastery=10;
  Item item;if(shield){caster.equip_index[0]=0;caster.inventory_data[0]=&item;caster.inventory.u.items_inventory[0].refine=10;}
  int actual=base;SkillShieldChain{}.calculateSkillRatio(nullptr,&caster,&caster,level,actual,0);
  int expected=base-100+300+200*level+(shield?190:0)+(powered?140*level:0);
  if(charlevel>99)expected=expected*charlevel/100;
  if(powered)expected+=expected*50/100;
  assert(actual==expected);
 }
 block_list mob;int ratio=100;SkillShieldChain{}.calculateSkillRatio(nullptr,&mob,&mob,1,ratio,0);assert(ratio==500);
 std::cout<<"Shield Chain levels, incoming bonuses, equipment, shield power and level scaling passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
