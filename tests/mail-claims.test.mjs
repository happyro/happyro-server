import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const args=process.argv.slice(2), plain=args.includes('--no-color');
const options=args.filter(arg=>arg!=='--no-color'), output=options[0];
if (!output || output==='--help') {
 const color=(code,text)=>plain?text:`\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36','HappyRO mail claim regression test')}\n\n${color('1;33','Usage')}\n  ${color('1;32','node tests/mail-claims.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33','Example')}\n  ${color('36','node tests/mail-claims.test.mjs /tmp/happyro-mail-claims')}\n`);
} else {
 if(options.length!==1||output.startsWith('-'))throw new Error('Expected one artifact path');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const extract=(file,signature)=>{
  const source=readFileSync(resolve(root,file),'utf8'),start=source.indexOf(signature);
  if(start<0)throw new Error(`Missing ${signature}`);
  let end=source.indexOf('{',start)+1,depth=1;
  while(depth&&end<source.length){depth+=(source[end]==='{')-(source[end]==='}');end++;}
  return source.slice(start,end);
 };
 const code=String.raw`
#include <cassert>
#include <unordered_map>
#include <cstring>
#define PACKETVER 20211103
#define ARR_FIND(start,end,i,condition) for(i=start;i<end;i++)if(condition)break

#include <cstdint>
#include <memory>
#include <iostream>
using uint32=uint32_t; using uint16=uint16_t; using int32=int32_t; using t_itemid=int;
constexpr int MAIL_MAX_ITEM=5,MAX_INVENTORY=10,MAX_AMOUNT=30000,LOG_TYPE_MAIL=0,PET_EGG=0,MAIL_ATT_NONE=0,MAIL_ATT_ITEM=1,MAIL_ATT_ZENY=2,MAIL_MAX_INBOX=10,MAX_ZENY=2147483647,ADDITEM_SUCCESS=0;
constexpr char CHKADDITEM_NEW=0,CHKADDITEM_EXIST=1,CHKADDITEM_OVERAMOUNT=2;
#define nullpo_ret(p) if(!(p))return 0
#define nullpo_retv(p) if(!(p))return
struct item {int nameid=0,amount=0,card[4]={};};
struct item_data {bool stackable=true;int weight=1;struct {bool inventory=false;int amount=30000;}stack;struct{bool guid=false;}flag;int inventorySlotNeeded(int){return 1;}} data;
struct mail_message {struct item item[5];uint32_t zeny=0;int send_id=1,id=0;};
struct map_session_data {struct {struct {struct item items_inventory[10];}u;}inventory;struct{int inventory_slots=10,zeny=0;}status;int weight=29000,max_weight=100000;struct{std::unordered_map<t_itemid,uint32> pending_items;int pending_weight=0,pending_slots=0,pending_zeny=0;struct{mail_message msg[10];}inbox;}mail;};
struct s_pet_db{};
std::shared_ptr<s_pet_db> pet_db_search(int,int){return nullptr;}
bool pet_create_egg(map_session_data*,int){return false;}
item_data* itemdb_search(int){return &data;}
bool itemdb_isstackable2(item_data* data){return data->stackable;}
int acknowledgements=0;
void clif_mail_getattachment(map_session_data*,mail_message*,int,int){acknowledgements++;}
void pc_getzeny(map_session_data* sd,int amount,int,int=0){sd->status.zeny+=amount;}
int pc_additem(map_session_data* sd,item* i,int amount,int){auto& slot=sd->inventory.u.items_inventory[0];if(slot.amount+amount>30000)return 1;slot.nameid=i->nameid;slot.amount+=amount;return 0;}

`
 +extract("src/map/pc.cpp","char pc_checkadditem(")
 +extract("src/map/mail.cpp","void mail_getattachment(")
 +String.raw`enum mail_attachment_type{dummy};
int request_id=0,requests_sent=0;
uint16 RFIFOW(int,int){return 0x9f3;}
int RFIFOQ(int,int){return request_id;}
bool chrif_isconnected(){return true;}
bool mail_invalid_operation(map_session_data*){return false;}
int pc_inventoryblank(map_session_data*){return 9;}
void intif_mail_getattach(map_session_data*,mail_message*,mail_attachment_type){requests_sent++;}
struct{std::shared_ptr<item_data> find(int){return std::make_shared<item_data>(data);}}item_db;
`
 +extract("src/map/clif.cpp","void clif_parse_Mail_getattach(")
 +String.raw`
map_session_data setup(int amount){
 map_session_data sd;sd.inventory.u.items_inventory[0]={909,amount};
 for(int i=0;i<2;i++){sd.mail.inbox.msg[i].id=i+1;sd.mail.inbox.msg[i].item[0]={909,600};}
 requests_sent=0;acknowledgements=0;data={};return sd;
}
void claim(map_session_data& sd,int id){request_id=id;clif_parse_Mail_getattach(0,&sd);}
void deliver(map_session_data& sd,int id){item items[5]={{909,600}};mail_getattachment(&sd,&sd.mail.inbox.msg[id-1],0,items);assert(items[0].amount==0);}
int main(){
 {auto sd=setup(29000);claim(sd,1);claim(sd,2);
  assert(requests_sent==1);assert(sd.mail.pending_items.at(909)==600);
  assert(sd.mail.inbox.msg[1].item[0].amount==600); // Rejected attachment remains claimable.
  assert(sd.mail.pending_weight==600);assert(sd.mail.pending_slots==0);
  deliver(sd,1);assert(sd.inventory.u.items_inventory[0].amount==29600);assert(sd.mail.pending_items.empty());
  claim(sd,2);assert(requests_sent==1);assert(sd.mail.inbox.msg[1].item[0].amount==600);
  sd.inventory.u.items_inventory[0].amount=28000;claim(sd,2);assert(requests_sent==2);
  deliver(sd,2);assert(sd.inventory.u.items_inventory[0].amount==28600);assert(sd.mail.pending_items.empty());}
 {auto sd=setup(28000);claim(sd,1);claim(sd,2);assert(requests_sent==2);assert(sd.mail.pending_items.at(909)==1200);
  deliver(sd,1);assert(sd.mail.pending_items.at(909)==600);deliver(sd,2);
  assert(sd.inventory.u.items_inventory[0].amount==29200);assert(sd.mail.pending_items.empty());assert(sd.mail.pending_weight==0);}
 {auto sd=setup(29000);sd.mail.inbox.msg[0].item[1]={909,600};claim(sd,1);
  assert(requests_sent==0);assert(sd.mail.pending_items.empty());assert(sd.mail.pending_weight==0);
  assert(sd.mail.inbox.msg[0].item[0].amount==600&&sd.mail.inbox.msg[0].item[1].amount==600);}
 {auto sd=setup(28800);claim(sd,1);claim(sd,2);assert(requests_sent==2);deliver(sd,2);deliver(sd,1);
  assert(sd.inventory.u.items_inventory[0].amount==30000);assert(sd.mail.pending_items.empty());}
 {auto sd=setup(500);data.stack.inventory=true;data.stack.amount=1000;
  sd.mail.inbox.msg[0].item[0].amount=300;sd.mail.inbox.msg[1].item[0].amount=300;
  claim(sd,1);claim(sd,2);assert(requests_sent==1);assert(sd.mail.pending_items.at(909)==300);
  assert(sd.mail.inbox.msg[1].item[0].amount==300);}
 {auto sd=setup(0);data.stackable=false;
  sd.mail.inbox.msg[0].item[0].amount=1;sd.mail.inbox.msg[1].item[0].amount=1;
  claim(sd,1);claim(sd,2);assert(requests_sent==2);assert(sd.mail.pending_items.empty());}
 std::cout<<"Mail claim reservation: overflow rejected before deletion, retry, concurrent claims, same-mail totals, exact limit and reply release passed\n";
}
`;
 const build=spawnSync('g++',['-O2','-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',resolve(output)],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(resolve(output),[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
