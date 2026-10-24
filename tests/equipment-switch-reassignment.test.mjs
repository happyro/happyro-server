import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('reassigning switch equipment clears old slots and preserves unrelated items', () => {
 const pc = fs.readFileSync(new URL('../src/map/pc.cpp', import.meta.url), 'utf8');
 // Locate the assignment branch independently of its implementation contents.
 const end = pc.indexOf('\n\t}else{', pc.indexOf('sd->inventory.u.items_inventory[n].equipSwitch = pos;', pc.indexOf('bool pc_equipitem(')));
 const begin = pc.lastIndexOf('\n\tif( equipswitch ){', end);
 assert.ok(begin >= 0 && end > begin);
 const removeStart=pc.indexOf('void pc_equipswitch_remove( map_session_data*');
 const remove=pc.slice(removeStart,pc.indexOf('\n}',removeStart)+2);
 const job=pc.slice(pc.indexOf('bool pc_jobchange('));
 const validationStart=job.indexOf('\tfor (int32 slot = 0;', job.indexOf('// Apply the new job'));
 const validationEnd=job.indexOf('\n\t}',validationStart)+3;
 assert.ok(validationStart>0 && validationEnd>validationStart);
 assert.ok(validationEnd<job.indexOf('equip_update.finish();'));
 assert.ok(job.indexOf('equip_update.finish();')<job.indexOf('chrif_save('));
 const wornStart=job.indexOf('\tfor (int32 slot = 0;',job.indexOf('// Mount/cart removal'));
 const wornEnd=job.indexOf('\n\t}',wornStart)+3;
 assert.ok(wornStart>0 && wornEnd>wornStart);
 const source = `
#include <cassert>
#include <cstdint>
constexpr int EQI_MAX=6, ITEM_EQUIP_ACK_OK=0;
const int equip_bitmask[EQI_MAX]={2,32,131072,262144,256,512};
using int32 = int;
struct item { int equipSwitch=0; };
struct Session {
 struct { struct { item items_inventory[6]; } u; } inventory;
 int equip_switch_index[EQI_MAX]={-1,-1,-1,-1,-1,-1};
 int equip_index[EQI_MAX]={-1,-1,-1,-1,-1,-1};
 int removes=0, adds=0, unequips=0;
 bool allowed[6]={true,true,true,true,true,true};
};
using map_session_data = Session;
void clif_equipswitch_remove(Session* sd,int,int,bool) { ++sd->removes; }
${remove}
void clif_equipswitch_add(Session* sd,int,int,int) { ++sd->adds; }
bool assign(Session* sd,int n,int pos) {
 int i; bool equipswitch=true;
${pc.slice(begin, end)}
 }
 return false;
}
int pc_isequip(Session* sd,int index) { return sd->allowed[index]?ITEM_EQUIP_ACK_OK:1; }
void pc_unequipitem(Session* sd,int index,int flag) {
 assert(flag==2); ++sd->unequips;
 for(int i=0;i<EQI_MAX;++i) if(sd->equip_index[i]==index) sd->equip_index[i]=-1;
}
void validateWorn(Session* sd) {
${job.slice(wornStart,wornEnd)}
}
void validateJob(Session* sd) {
${job.slice(validationStart,validationEnd)}
}
void check(Session& s) {
 for(int i=0;i<EQI_MAX;++i) {
  int index=s.equip_switch_index[i];
  if(index>=0) assert(s.inventory.u.items_inventory[index].equipSwitch & equip_bitmask[i]);
 }
 for(int n=0;n<6;++n) for(int i=0;i<EQI_MAX;++i)
  if(s.inventory.u.items_inventory[n].equipSwitch & equip_bitmask[i]) assert(s.equip_switch_index[i]==n);
}
int main() {
 {
  Session s;
  s.equip_index[0]=0; s.equip_index[1]=0; s.equip_index[2]=1; s.equip_index[4]=2;
  validateWorn(&s); assert(s.unequips==0);
  s.allowed[0]=false; s.allowed[1]=false;
  validateWorn(&s);
  assert(s.unequips==2 && s.equip_index[0]==-1 && s.equip_index[1]==-1);
  assert(s.equip_index[2]==-1 && s.equip_index[4]==2);
  validateWorn(&s); assert(s.unequips==2);
  assign(&s,0,2|32); assign(&s,1,131072); assign(&s,2,256);
  s.allowed[0]=false; s.allowed[1]=false;
  validateJob(&s); check(s);
  assert(s.removes==2);
  assert(s.inventory.u.items_inventory[0].equipSwitch==0);
  assert(s.inventory.u.items_inventory[1].equipSwitch==0);
  assert(s.inventory.u.items_inventory[2].equipSwitch==256);
  validateJob(&s); assert(s.removes==2);
 }

 for(auto pair : { std::pair<int,int>{2,32}, {131072,262144}, {256,512} }) {
  Session s;
  assign(&s,0,pair.first); check(s);
  assign(&s,1, pair.first==2 ? 256 : 2); check(s);
  assign(&s,0,pair.second); check(s);
  assert(s.inventory.u.items_inventory[1].equipSwitch!=0);
  assign(&s,0,pair.second); check(s);
  assign(&s,2,pair.first|pair.second); check(s);
  assign(&s,2,pair.first); check(s);
  assert(s.inventory.u.items_inventory[0].equipSwitch==0);
 }
}
`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'happyro-switch-reassign-'));
 try {
  const binary=path.join(dir,'test');
  const compile=spawnSync('c++',['-std=c++17','-fsanitize=address,undefined','-include','utility','-include','initializer_list','-x','c++','-','-o',binary],{input:source,encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const run=spawnSync(binary,[],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
