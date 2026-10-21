import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),plain=args.includes('--no-color'),options=args.filter(x=>x!=='--no-color');
if(!options.length||options[0]==='--help'){
 const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
 console.log(`\n${c('1;36','HappyRO homunculus passive bonuses')}\n\n${c('1;33','Usage')}\n  ${c('1;32','node tests/homunculus-passive-bonuses.test.mjs <artifact-path>')} [--no-color]\n\n${c('1;33','Example')}\n  ${c('36','node tests/homunculus-passive-bonuses.test.mjs ../../work/companion-audit-full/passive-test')}\n`);
}else{
 if(options.length!==1||options[0].startsWith('-'))throw Error('Expected artifact path');
 const root=fileURLToPath(new URL('../',import.meta.url)),source=readFileSync(resolve(root,'src/map/status.cpp'),'utf8');
 const a=source.indexOf('\tif((skill_lv = hom_checkskill(hd, HAMI_SKIN)) > 0)'),b=source.indexOf('\n\tstatus_cpy(&hd->battle_status, status);',a);
 if(a<0||b<0)throw Error('Production homunculus recalculation not found');
 const body=source.slice(a,b);
 const recalculationStart=source.indexOf('\t\tif (bl.type == BL_HOM) {',source.indexOf('// MATK = StatusMATK + WeaponMATK + ExtraMATK'));
 const recalculationEnd=source.indexOf('\n\t\tif (sd != nullptr)',recalculationStart);
 if(recalculationStart<0||recalculationEnd<0)throw Error('Missing homunculus battle MATK bonus preservation');
 const recalculation=source.slice(recalculationStart,recalculationEnd);
 const code=`#include <cassert>
#include <cstdint>
#include <map>
#include <iostream>
using int32=int;using uint8=uint8_t;
enum { HAMI_SKIN,HVAN_INSTRUCT,HLIF_BRAIN,MH_CLASSY_FLUTTER,MH_BRUSHUP_CLAW,MH_POLISHING_NEEDLE,MH_LICHT_GEHORN,MH_BLAZING_LAVA,SC_STYLE_CHANGE,MH_MD_FIGHTING,INFINITE_TICK,SCO_FIRST=1024 };
struct Status{int batk=0,matk_min=0,matk_max=0,def=0,max_hp=1000,max_sp=100,int_=10,str=10,hp=1000,sp=100;};
struct Hom{int class_=6048,level=200,hp=1000,sp=100;};
enum {BL_HOM=100,BL_PC};struct Block{int type=BL_HOM;};
int status_base_matk_min(Block*,const Status*,int){return 400;}
int status_base_matk_max(Block*,const Status*,int){return 500;}
struct HD{Status battle_status;std::map<int,int> skills;};
int hom_checkskill(HD* h,int id){return h->skills[id];}
void status_calc_misc(HD*,Status* s,int){s->batk=300;s->matk_min=400;s->matk_max=500;}
void sc_start(HD*,HD*,int,int,int,int){}
Status calculate(std::map<int,int> skills){HD data;data.skills=skills;auto* hd=&data;Status result;auto* status=&result;Hom hom;int skill_lv=0,opt=0;
${body}
return result;}
Status recalculateBattle(Status base){Block bl;auto* b_status=&base;Status result=base;auto* status=&result;int lv=200;int matk_min=400,matk_max=500;
${recalculation}
result.matk_min=matk_min;result.matk_max=matk_max;return result;}
int main(){
 auto base=calculate({});assert(base.batk==300&&base.matk_min==400&&base.matk_max==500);
 struct Case{int skill,atk,matk;};
 for(auto c:{Case{MH_CLASSY_FLUTTER,0,700},Case{MH_BRUSHUP_CLAW,700,0},Case{MH_POLISHING_NEEDLE,500,250},Case{MH_LICHT_GEHORN,400,400},Case{MH_BLAZING_LAVA,700,0}}){auto s=calculate({{c.skill,10}});assert(s.batk==base.batk+c.atk);assert(s.matk_min==base.matk_min+c.matk);assert(s.matk_max==base.matk_max+c.matk);auto battle=recalculateBattle(s);assert(battle.matk_min==s.matk_min&&battle.matk_max==s.matk_max);auto again=calculate({{c.skill,10}});assert(again.batk==s.batk&&again.matk_max==s.matk_max);}
 auto mixed=calculate({{MH_CLASSY_FLUTTER,10},{HAMI_SKIN,5},{HVAN_INSTRUCT,5},{HLIF_BRAIN,5}});assert(mixed.max_hp==1100&&mixed.max_sp==105&&mixed.def==20&&mixed.str==14&&mixed.int_==15&&mixed.matk_max==1200);
 std::cout<<"homunculus passive bonus production-order regression passed\\n";
}
`;
 const target=resolve(options[0]);mkdirSync(dirname(target),{recursive:true});writeFileSync(target+'.cpp',code);
 const compile=spawnSync('c++',['-std=c++17','-DRENEWAL',...(process.platform==='darwin'?['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk']:[]),target+'.cpp','-o',target],{stdio:'inherit'});if(compile.status)process.exit(compile.status);const test=spawnSync(target,[],{stdio:'inherit'});if(test.status)process.exit(test.status);
}
