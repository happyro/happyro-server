import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),plain=args.includes('--no-color'),options=args.filter(x=>x!=='--no-color');
if(!options.length||options[0]==='--help'){
 const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
 console.log(`\n${c('1;36','HappyRO homunculus combo targeting')}\n\n${c('1;33','Usage')}\n  ${c('1;32','node tests/homunculus-combo-target.test.mjs <artifact-path>')} [--no-color]\n\n${c('1;33','Example')}\n  ${c('36','node tests/homunculus-combo-target.test.mjs ../../work/companion-audit-full/combo-target-test')}\n`);
}else{
 if(options.length!==1||options[0].startsWith('-'))throw Error('Expected artifact path');
 const root=fileURLToPath(new URL('../',import.meta.url)),s=readFileSync(resolve(root,'src/map/unit.cpp'),'utf8');
 const a=s.indexOf('static int32 unit_homunculus_combo_target('),b=s.indexOf('\n/**',a);
 if(a<0||b<0)throw Error('Missing production resolver');
 const routeA=s.indexOf('\tconst int32 homunculus_combo_target =',b),routeB=s.indexOf('} else if (sc &&',routeA);
 if(routeA<0||routeB<0)throw Error('Missing production route');
 const route=s.slice(routeA,routeB)+'}';
 const code=`#include <cassert>
#include <cstdint>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;
enum{BL_HOM=1,BL_PC,BL_MER,SC_COMBO,MH_SONIC_CRAW,MH_SILVERVEIN_RUSH,MH_MIDNIGHT_FRENZY,MH_TINDER_BREAKER,MH_CBC,MH_EQC};
struct block_list{int type=BL_HOM,id=100;};struct Entry{int val1=0,val2=0;};struct status_change{Entry* entry=nullptr;Entry* getSCE(int){return entry;}};
${s.slice(a,b)}
int route(block_list* src,status_change* sc,int skill_id,int target_id){int combo=0;${route}return combo?target_id:-1;}
int main(){block_list hom;Entry e;status_change sc;sc.entry=&e;
 struct Pair{int current,previous;};for(auto p:{Pair{MH_SILVERVEIN_RUSH,MH_SONIC_CRAW},Pair{MH_MIDNIGHT_FRENZY,MH_SILVERVEIN_RUSH},Pair{MH_CBC,MH_TINDER_BREAKER},Pair{MH_EQC,MH_CBC}}){
 e={p.previous,200};assert(route(&hom,&sc,p.current,hom.id)==200);assert(route(&hom,&sc,p.current,999)==200);
 assert(route(&hom,nullptr,p.current,200)==0);sc.entry=nullptr;assert(route(&hom,&sc,p.current,200)==0);sc.entry=&e;
 e.val1=p.current;assert(route(&hom,&sc,p.current,200)==0);e.val1=p.previous;
 for(int bad:{0,-2,100}){e.val2=bad;assert(route(&hom,&sc,p.current,200)==0);}
 e.val2=200;for(int type:{BL_PC,BL_MER}){block_list other;other.type=type;assert(route(&other,&sc,p.current,999)==-1);}
 }
 assert(route(&hom,&sc,999,200)==-1);std::cout<<"Eleanor live-chain target and missing/expired/wrong-chain rejection passed\\n";}
`;
 const target=resolve(options[0]);mkdirSync(dirname(target),{recursive:true});writeFileSync(target+'.cpp',code);
 const build=spawnSync('c++',['-std=c++17',...(process.platform==='darwin'?['-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk']:[]),target+'.cpp','-o',target],{stdio:'inherit'});if(build.status)process.exit(build.status);const run=spawnSync(target,[],{stdio:'inherit'});if(run.status)process.exit(run.status);
}
