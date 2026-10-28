import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args=process.argv.slice(2), plain=args.includes('--no-color');
const positional=args.filter(a=>a!=='--no-color');
if (!positional.length || positional[0]==='--help') {
 const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
 console.log(`\n${c('1;36','Guild storage cart lock regression')}\n\n${c('1;33','Usage')}\n ${c('1;32','node tests/guild-storage-cart-lock.test.mjs <output>')} [--no-color]\n\n${c('1;33','Example')}\n ${c('36','node tests/guild-storage-cart-lock.test.mjs ../../work/guild-storage-cart-lock')}\n`);
} else {
 const source=readFileSync(new URL('../src/map/storage.cpp',import.meta.url),'utf8');
 const functions=['storage_guild_storageaddfromcart','storage_guild_storagegettocart'].map(name=>{
  const start=source.indexOf(`void ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);
 }).join('\n');
 const guild=readFileSync(new URL('../src/map/guild.cpp',import.meta.url),'utf8');
 const start=guild.indexOf('int32 guild_change_memberposition(');
 const position=guild.slice(start,guild.indexOf('\n}',start)+2);
 const program=`
 #include <cassert>
 using int32=int;using int16=short;using uint32=unsigned int;
 constexpr int MAX_GUILDPOSITION=20,GMI_POSITION=1;
 int positionWrites=0;
 int intif_guild_change_memberinfo(int,uint32,uint32,int,void*,unsigned long){positionWrites++;return 1;}
 ${position}
 #define nullpo_retv(p) if(!(p))return
 constexpr int MAX_CART=10,LOG_TYPE_GSTORAGE=1,ADDITEM_INVALID=1,ADDITEM_TO_CART_FAIL_WEIGHT=1,ADDITEM_TO_CART_FAIL_COUNT=2;
 struct item{int nameid=501,amount=10;};
 struct s_storage{bool status=true,lock=false;int amount=1,max_amount=10;struct{item items_guild[10];}u;} storage;
 struct map_session_data{struct{int guild_id=1;}status;struct{struct{item items_cart[10];}u;}cart;};
 int closed=0,added=0,deleted=0;
 s_storage* guild2storage2(int){return &storage;}
 void storage_guild_storageclose(map_session_data*){closed++;}
 bool storage_guild_additem(map_session_data*,s_storage*,item*,int){added++;return true;}
 void pc_cart_delitem(map_session_data*,int,int,int,int){deleted++;}
 int pc_cart_additem(map_session_data*,item*,int,int){added++;return 0;}
 void storage_guild_delitem(map_session_data*,s_storage*,int,int){deleted++;}
 void clif_storageitemremoved(map_session_data&,int,int){}
 void clif_dropitem(map_session_data&,int,int){}
 void clif_cart_additem_ack(map_session_data&,int){}
 ${functions}
 int main(){
 guild_change_memberposition(1,2,3,-1);guild_change_memberposition(1,2,3,0);guild_change_memberposition(1,2,3,20);guild_change_memberposition(1,2,3,32767);assert(positionWrites==0);
 guild_change_memberposition(1,2,3,1);guild_change_memberposition(1,2,3,19);assert(positionWrites==2);
 map_session_data sd;
 for(auto transfer:{storage_guild_storageaddfromcart,storage_guild_storagegettocart}){
  closed=added=deleted=0;storage.lock=true;transfer(&sd,0,1);assert(closed==1 && added==0 && deleted==0);
  closed=0;storage.lock=false;transfer(&sd,0,1);assert(closed==0 && added==1 && deleted==1);
  transfer(&sd,-1,1);transfer(&sd,0,0);transfer(&sd,0,11);assert(added==1 && deleted==1);
 }
 }
 `;
 const binary=resolve(positional[0]);
 const compile=spawnSync('c++',['-std=c++17','-include','initializer_list','-x','c++','-','-o',binary],{input:program,encoding:'utf8'});
 if(compile.status!==0)throw Error(compile.stderr);
 const run=spawnSync(binary,{stdio:'inherit'});if(run.status!==0)throw Error('Regression failed');
 console.log('PASS: locked cart transfers close without mutations; unlocked transfers succeed; invalid requests do not mutate; member positions stay within bounds');
}
