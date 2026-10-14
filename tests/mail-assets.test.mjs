import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
const output = options[0];
if (!output || output === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO mail assets and character names regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/mail-assets.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/mail-assets.test.mjs /tmp/happyro-mail-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const extract = (file, signature) => {
    const source = readFileSync(resolve(root, file), 'utf8');
    const start = source.indexOf(signature);
    if (start < 0) throw new Error(`Missing ${signature}`);
    let end = source.indexOf('{', start) + 1, depth = 1;
    while (depth && end < source.length) { depth += (source[end] === '{') - (source[end] === '}'); end++; }
    return source.slice(start, end);
  };
  const code = `
#include <cstdint>
#include <climits>
#include <cstring>
#include <iostream>
#include <cstdlib>
#include <cassert>
using uint32=uint32_t;using int32=int32_t;using int64=int64_t;
constexpr int MAIL_MAX_ITEM=5,MAX_INVENTORY=5,MAX_ZENY=INT_MAX,LOG_TYPE_MAIL=0,SP_ZENY=0;
#define nullpo_retr(value,p) if(!(p))return value
struct item {int nameid=0,amount=0;};
struct mail_message {struct item item[5];unsigned zeny=0;};
struct map_session_data {
 struct {struct {int index=0,nameid=0,amount=0;} item[5];int32 zeny=0,dest_id=2;} mail;
 struct {struct {struct item items_inventory[5];} u;} inventory;
 struct {int32 zeny=0;} status;
 void* inventory_data[5]={};
 int weight=0,max_weight=100;
};
struct {int mail_zeny_fee=2,mail_attachment_price=2500;} battle_config;
namespace util {
 template<class T> bool safe_multiplication(T a,T b,T& out){return __builtin_mul_overflow(a,b,&out);}
 template<class T> bool safe_addition(T a,T b,T& out){return __builtin_add_overflow(a,b,&out);}
}
int payment_failures=0; bool fail_payment=false; int removed=0;
int pc_payzeny(map_session_data* sd,int32 amount,int,int){if(fail_payment||amount<0||sd->status.zeny<amount){payment_failures++;return 1;}sd->status.zeny-=amount;return 0;}
void clif_updatestatus(map_session_data&,int){}
int mail_removeitem(map_session_data* sd,int,int idx,int amount){if(pc_payzeny(sd,battle_config.mail_attachment_price,0,0))return 0;sd->inventory.u.items_inventory[idx-2].amount-=amount;removed+=amount;return 1;}

${extract('src/map/mail.cpp', 'bool mail_removezeny(')}
${extract('src/map/mail.cpp', 'bool mail_setattachment(')}
${extract('src/char/char_clif.cpp', 'static bool chclif_valid_creation_name(')}

int main(){
 for(int32 amount:{1000000000,1100000000,2147483647}){
  map_session_data sd;sd.status.zeny=amount;sd.mail.zeny=amount;mail_message msg;
  assert(!mail_setattachment(&sd,&msg));assert(sd.status.zeny==amount);assert(msg.zeny==0);
 }
 {map_session_data sd;sd.mail.zeny=1100000000;sd.status.zeny=1122000000;mail_message msg;
 assert(mail_setattachment(&sd,&msg));assert(sd.status.zeny==0);assert(msg.zeny==1100000000);}
 {map_session_data sd;sd.mail.zeny=100;sd.status.zeny=102;mail_message msg;fail_payment=true;
 assert(!mail_setattachment(&sd,&msg));assert(msg.zeny==0);assert(sd.status.zeny==102);fail_payment=false;}
 for(int balance:{2601,2602}){
 map_session_data sd;sd.mail.zeny=100;sd.status.zeny=balance;mail_message msg;removed=0;
 sd.mail.item[2]={1,501,2};sd.inventory.u.items_inventory[1]={501,2};sd.inventory_data[1]=&sd;
 assert(mail_setattachment(&sd,&msg)==(balance==2602));
 assert(sd.status.zeny==(balance==2602?0:balance));assert(removed==(balance==2602?2:0));}
 {map_session_data sd;sd.status.zeny=10000;mail_message msg;sd.mail.item[0]={9,501,2};
 assert(!mail_setattachment(&sd,&msg));assert(sd.status.zeny==10000);}
 {map_session_data sd;sd.status.zeny=10000;mail_message msg;
 sd.mail.item[0]={1,501,1};sd.mail.item[1]={1,501,1};sd.inventory.u.items_inventory[1]={501,2};sd.inventory_data[1]=&sd;
 assert(!mail_setattachment(&sd,&msg));assert(sd.status.zeny==10000);}
 char valid[24]="ab一二三四五六七";
 assert(chclif_valid_creation_name(valid,sizeof(valid)));
 char missing[24];memset(missing,'a',sizeof(missing));assert(!chclif_valid_creation_name(missing,sizeof(missing)));
 for(const char* invalid:{"\\xe4\\xb8", "\\xc0\\x80", "\\xed\\xa0\\x80", "\\xf4\\x90\\x80\\x80", "\\x80", ""})
 assert(!chclif_valid_creation_name(invalid,strlen(invalid)+1));
 assert(chclif_valid_creation_name("勇者😀",strlen("勇者😀")+1));
 std::cout<<"Mail overflow, exact funds, payment failure, attachments and UTF-8 name checks passed\\n";
}
`;
  const build = spawnSync('g++', ['-O3', '-fno-strict-aliasing', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-std=c++17', '-x', 'c++', '-', '-o', resolve(output)], {input:code,stdio:['pipe','inherit','inherit']});
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], {stdio:'inherit'});
  process.exit(run.status || (run.signal ? 1 : 0));
}
