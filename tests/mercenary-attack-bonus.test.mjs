import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),plain=args.includes('--no-color'),options=args.filter(x=>x!=='--no-color');
if(!options.length||options[0]==='--help'){
 const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
 console.log(`\n${c('1;36','HappyRO mercenary attack bonus')}\n\n${c('1;33','Usage')}\n  ${c('1;32','node tests/mercenary-attack-bonus.test.mjs <artifact-path>')} [--no-color]\n\n${c('1;33','Example')}\n  ${c('36','node tests/mercenary-attack-bonus.test.mjs ../../work/companion-audit-full/mercenary-atk-test')}\n`);
}else{
 if(options.length!==1||options[0].startsWith('-'))throw Error('Expected artifact path');
 const root=fileURLToPath(new URL('../',import.meta.url)),s=readFileSync(resolve(root,'src/map/status.cpp'),'utf8');
 const a=s.indexOf('\tif(flag[SCB_WATK]) {'),b=s.indexOf('\n\tif(flag[SCB_HIT])',a);if(a<0||b<0)throw Error('Missing production attack recalc');
 const body=s.slice(a,b);
 const code=`#include <cassert>
#include <bitset>
#include <iostream>
enum {SCB_WATK,BL_MER,BL_PC,BL_HOM};
struct Weapon{int atk=0,atk2=0;};struct Status{Weapon rhw,lhw;int watk=0,watk2=0;};struct Block{int type;};struct Change{int bonus;};
int status_calc_watk(Block*,Change* sc,int value){return value+(sc?sc->bonus:0);}
void recalc(Block bl,Status* status,Status* b_status,Change* sc){std::bitset<4> flag;flag.set(SCB_WATK);
${body}}
int main(){Status base;base.rhw={160,240};Status result=base;Block merc{BL_MER};
for(int lv=1;lv<=5;lv++){Change bonus{15*lv};recalc(merc,&result,&base,&bonus);assert(result.rhw.atk==160+15*lv);assert(result.rhw.atk2==240+15*lv);recalc(merc,&result,&base,&bonus);assert(result.rhw.atk==160+15*lv);}
recalc(merc,&result,&base,nullptr);assert(result.rhw.atk==160&&result.rhw.atk2==240);
for(int type:{BL_PC,BL_HOM}){Status other=base;Change bonus{75};recalc({type},&other,&base,&bonus);assert(other.rhw.atk==160&&other.rhw.atk2==240);}
std::cout<<"Renewal mercenary bonus affects damage range once and expires without changing unrelated units\\n";}
`;
 const target=resolve(options[0]);mkdirSync(dirname(target),{recursive:true});writeFileSync(target+'.cpp',code);
 const result=spawnSync('c++',['-std=c++17','-DRENEWAL',...(process.platform==='darwin'?['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk']:[]),target+'.cpp','-o',target],{stdio:'inherit'});if(result.status)process.exit(result.status);const run=spawnSync(target,[],{stdio:'inherit'});if(run.status)process.exit(run.status);
}
