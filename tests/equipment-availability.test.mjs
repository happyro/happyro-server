import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function body(source,signature){const start=source.indexOf(signature);assert.ok(start>=0,signature);return source.slice(start,source.indexOf('\n}\n',start)+3);}
test('production eligibility checks are silent and preserve live wear rules',()=>{
 const pc=read('src/map/pc.cpp');
 const code=read('tests/equipment-availability-stubs.hpp')+['static bool pc_job_can_use_item(', 'static bool pc_isItemClass (','static uint8 pc_check_equip(', 'uint8 pc_isequip(', 'bool pc_equipment_candidate(', 'bool pc_equipment_action_blocked('].map(signature=>body(pc,signature)).join('\n')+read('tests/equipment-availability-cases.hpp');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'happyro-equipment-'));
 try{
  const binary=path.join(dir,'check');
  const compile=spawnSync('c++',['-std=c++17','-fsanitize=address,undefined','-x','c++','-','-o',binary],{input:code,encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const result=spawnSync(binary,[],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS:/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('production query parser rejects malformed requests and validates live inventory identity',()=>{
 const packets=read('src/map/packets.hpp');
 const declarations=packets.slice(packets.indexOf('struct PACKET_CZ_HAPPYRO_EQUIPMENT_ENTRY'),packets.indexOf('struct PACKET_CZ_HAPPYRO_NPC_AVAILABILITY_ENTRY'));
 const code=`
#include <cstdint>
#include <cstring>
#include <cassert>
#include <cstdio>
using uint16=uint16_t;using int16=int16_t;using uint32=uint32_t;using uint8=uint8_t;using int32=int32_t;
#define DEFINE_PACKET_HEADER(name,id) constexpr int HEADER_##name=id
${declarations}
constexpr int MAX_INVENTORY=10;alignas(8) unsigned char input[2048]={},output[2048]={};int closed=0,sent=0,checks=0;
struct map_session_data{struct{struct{struct{uint32 nameid=0;}items_inventory[MAX_INVENTORY];}u;}inventory;};
#define RFIFOW(fd,offset) (*reinterpret_cast<uint16*>(input+offset))
#define RFIFOP(fd,offset) (input+offset)
#define WFIFOW(fd,offset) (*reinterpret_cast<uint16*>(output+offset))
#define WFIFOL(fd,offset) (*reinterpret_cast<uint32*>(output+offset))
#define WFIFOB(fd,offset) (output[offset])
#define WFIFOHEAD(fd,size) assert(size<sizeof(output))
#define WFIFOSET(fd,size) sent=size
void set_eof(int){closed++;}
uint16 server_index(uint16 index){return index-2;}
bool pc_equipment_action_blocked(map_session_data*){return false;}
bool pc_equipment_candidate(map_session_data*,int n,uint32){checks++;return n==0;}
${body(read('src/map/clif.cpp'),'void clif_parse_happyro_equipment_availability(')}
int main(){
 map_session_data sd;sd.inventory.u.items_inventory[0].nameid=2301;
 auto* p=reinterpret_cast<PACKET_CZ_HAPPYRO_EQUIPMENT_AVAILABILITY*>(input);
 p->packetLength=26;p->requestId=123;p->position=16;p->count=2;p->items[0]={2,2301};p->items[1]={2,999};
 clif_parse_happyro_equipment_availability(1,&sd);assert(sent==13&&closed==0&&checks==1);assert(output[11]==1&&output[12]==0);
 p->items[0]={0,2301};p->items[1]={65535,2301};checks=0;
 clif_parse_happyro_equipment_availability(1,&sd);assert(checks==0&&output[11]==0&&output[12]==0);
 for(int kind=0;kind<5;kind++){
  p->packetLength=26;p->count=2;p->position=16;sent=0;closed=0;
  if(kind==0)p->packetLength=4;
  if(kind==1)p->count=101;
  if(kind==2)p->position=3;
  if(kind==3)p->count=0;
  if(kind==4)p->packetLength=25;
  clif_parse_happyro_equipment_availability(1,&sd);assert(closed==1&&sent==0);
 }
 puts("PASS: packet bounds and live item identities");
}
`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'happyro-equipment-packets-'));
 try{
  const binary=path.join(dir,'check');
  const compile=spawnSync('c++',['-std=c++17','-fsanitize=address,undefined','-x','c++','-','-o',binary],{input:code,encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
  const run=spawnSync(binary,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/PASS:/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
