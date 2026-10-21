#include "admin_delete.hpp"
#include <array>
#include <cstdarg>
#include <cstdlib>
#include <random>
#include <string>
#include <common/showmsg.hpp>
#include <common/socket.hpp>
#include <common/sql.hpp>
#include <common/timer.hpp>
#include "char.hpp"
#include "char_mapif.hpp"
#include "inter.hpp"

namespace {
struct Barrier {
 uint32 account_id = 0;
 uint64 nonce = 0;
 std::array<int32,MAX_MAP_SERVERS> connections{};
 std::array<bool,MAX_MAP_SERVERS> expected{};
 std::array<bool,MAX_MAP_SERVERS> acknowledged{};
};
Barrier barrier;

bool query(const char* format,...) {
 va_list args;va_start(args,format);
 const int32 result=Sql_QueryV(sql_handle,format,args);
 va_end(args);
 if(result!=SQL_SUCCESS){Sql_ShowDebug(sql_handle);return false;}
 return true;
}
bool scalar(uint64& value,const char* format,...) {
 va_list args;va_start(args,format);
 const int32 result=Sql_QueryV(sql_handle,format,args);va_end(args);
 if(result!=SQL_SUCCESS){Sql_ShowDebug(sql_handle);return false;}
 char* raw=nullptr;
 if(Sql_NextRow(sql_handle)!=SQL_SUCCESS||Sql_GetData(sql_handle,0,&raw,nullptr)!=SQL_SUCCESS||raw==nullptr){Sql_FreeResult(sql_handle);return false;}
 value=std::strtoull(raw,nullptr,10);Sql_FreeResult(sql_handle);return true;
}
void failed(uint32 id,const char* code) {
 query("UPDATE happyro_admin_account_deletions SET status='failed',error_code='%s' WHERE account_id='%u'",code,id);
 barrier=Barrier{};
}
bool owns_worker_lock() {
 uint64 owner=0;
 if(!scalar(owner,"SELECT COALESCE(IS_USED_LOCK('happyro-account-deletions')=CONNECTION_ID(),0)"))return false;
 if(owner==1)return true;
 return scalar(owner,"SELECT GET_LOCK('happyro-account-deletions',0)")&&owner==1;
}
bool fenced(uint32 id) {
 if(barrier.account_id!=id){
  barrier=Barrier{};barrier.account_id=id;
  std::random_device random;
  barrier.nonce=(static_cast<uint64>(random())<<32)^random();
 }
 char_get_authdb().erase(id);
 char_disconnect_player(id);
 bool connected=false,ready=true;
 for(int32 i=0;i<MAX_MAP_SERVERS;i++){
  const int32 fd=map_server[i].fd;
  if(!session_isActive(fd)){
   if(barrier.expected[i])ready=false;
   continue;
  }
  connected=true;
  if(!barrier.expected[i]||barrier.connections[i]!=fd){
   barrier.connections[i]=fd;barrier.expected[i]=true;barrier.acknowledged[i]=false;
  }
  if(!barrier.acknowledged[i]){
   ready=false;
   WFIFOHEAD(fd,14);WFIFOW(fd,0)=0x2b29;WFIFOL(fd,2)=id;WFIFOQ(fd,6)=barrier.nonce;WFIFOSET(fd,14);
  }
 }
 // Never equate an unavailable map server with a successfully saved logout.
 if(!connected||!ready)return false;
 auto online=char_get_onlinedb().find(id);
 if(online!=char_get_onlinedb().end()&&session_isActive(online->second->fd))return false;
 return true;
}
bool cleanup_account(uint32 id) {
 // Delete pets referenced by eggs in this account's storage before storage rows.
 if(!query("DELETE p FROM `%s` p JOIN `%s` s ON p.pet_id=(s.card1 | (s.card2 << 16)) WHERE s.account_id='%u' AND s.card0=256",schema_config.pet_db,schema_config.storage_db,id))return false;
 for(const char* table:std::initializer_list<const char*>{schema_config.storage_db,schema_config.acc_reg_num_table,schema_config.acc_reg_str_table,"global_acc_reg_num","global_acc_reg_str","happyro_sessions","user_configs","char_configs","merchant_configs","party_bookings"}){
  if(!query("DELETE FROM `%s` WHERE account_id='%u'",table,id))return false;
 }
 // Retain historical logs and grant receipts, which are audit evidence rather
 // than playable state. A transferred pet egg may legitimately belong elsewhere.
 if(!query("UPDATE `%s` SET account_id=0 WHERE account_id='%u'",schema_config.pet_db,id))return false;
 if(!query("DELETE FROM login WHERE account_id='%u' AND sex<>'S'",id))return false;
 char_get_authdb().erase(id);char_get_onlinedb().erase(id);
 return true;
}
void process_job(uint32 id) {
 uint64 protected_account=0;
 if(!scalar(protected_account,"SELECT COUNT(*) FROM login WHERE account_id='%u' AND sex='S'",id)){failed(id,"database_error");return;}
 if(protected_account){failed(id,"protected_account");return;}
 if(!query("UPDATE login SET state=1,web_auth_token=NULL,web_auth_token_enabled=0 WHERE account_id='%u' AND sex<>'S'",id)){failed(id,"database_error");return;}
 if(!fenced(id)){
  query("UPDATE happyro_admin_account_deletions SET status='disconnecting' WHERE account_id='%u'",id);return;
 }
 // Auctions own escrowed items and bids in the char-server cache. Let normal
 // settlement finish before removing any character; SQL deletion would lose
 // other players' assets and leave the auction timer alive.
 uint64 auctions=0;
 if(!scalar(auctions,"SELECT COUNT(*) FROM `%s` a JOIN `%s` c ON (a.seller_id=c.char_id OR a.buyer_id=c.char_id) WHERE c.account_id='%u'",schema_config.auction_db,schema_config.char_db,id)){failed(id,"database_error");return;}
 if(auctions){failed(id,"active_auction");return;}
 uint64 remaining=0;
 if(!scalar(remaining,"SELECT COUNT(*) FROM `%s` WHERE account_id='%u'",schema_config.char_db,id)){failed(id,"database_error");return;}
 if(!query("UPDATE happyro_admin_account_deletions SET status='deleting',total_characters=GREATEST(total_characters,%llu),deleted_characters=GREATEST(total_characters,%llu)-%llu WHERE account_id='%u'",static_cast<unsigned long long>(remaining),static_cast<unsigned long long>(remaining),static_cast<unsigned long long>(remaining),id)){return;}
 if(remaining>0){
  uint64 char_id=0;
  if(!scalar(char_id,"SELECT char_id FROM `%s` WHERE account_id='%u' ORDER BY char_id LIMIT 1",schema_config.char_db,id)){failed(id,"database_error");return;}
  char_session_data session{};session.account_id=id;session.found_char[0]=static_cast<uint32>(char_id);
  if(char_delete(&session,static_cast<uint32>(char_id),true)!=CHAR_DELETE_OK){failed(id,"character_cleanup_failed");return;}
  query("UPDATE happyro_admin_account_deletions SET deleted_characters=total_characters-%llu WHERE account_id='%u'",static_cast<unsigned long long>(remaining-1),id);
  return; // Bound each tick to one character; keep the game event loop responsive.
 }
 if(!cleanup_account(id)){failed(id,"account_cleanup_failed");return;}
 if(query("UPDATE happyro_admin_account_deletions SET status='completed',error_code=NULL,completed_at=UTC_TIMESTAMP(6) WHERE account_id='%u'",id))barrier=Barrier{};
}
TIMER_FUNC(process_deletions) {
 if(!owns_worker_lock())return 0;
 if(!query("INSERT INTO happyro_admin_workers(worker_name,heartbeat_at) VALUES('account-deletions',UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE heartbeat_at=VALUES(heartbeat_at)"))return 0;
 if(!query("SELECT account_id FROM happyro_admin_account_deletions WHERE status IN ('queued','disconnecting','deleting') ORDER BY (account_id='%u') DESC,updated_at,account_id LIMIT 1",barrier.account_id))return 0;
 if(Sql_NextRow(sql_handle)!=SQL_SUCCESS){Sql_FreeResult(sql_handle);return 0;}
 char* raw=nullptr;Sql_GetData(sql_handle,0,&raw,nullptr);const uint32 account_id=static_cast<uint32>(std::strtoul(raw,nullptr,10));Sql_FreeResult(sql_handle);
 process_job(account_id);return 0;
}
}

bool admin_account_blocked(uint32 account_id) {
 uint64 count=0;
 // Fail closed: a missing queue table must not let a deleting account reconnect.
 return !scalar(count,"SELECT COUNT(*) FROM happyro_admin_account_deletions WHERE account_id='%u'",account_id)||count!=0;
}
bool admin_delete_character_auxiliary(uint32 char_id) {
 // Offline shop rows can survive a map-server restart. Remove their children
 // first so a retry can still locate them if a later statement fails.
 if(!query("DELETE i FROM vending_items i JOIN vendings v ON v.id=i.vending_id WHERE v.char_id='%u'",char_id))return false;
 if(!query("DELETE FROM vendings WHERE char_id='%u'",char_id))return false;
 if(!query("DELETE i FROM buyingstore_items i JOIN buyingstores b ON b.id=i.buyingstore_id WHERE b.char_id='%u'",char_id))return false;
 if(!query("DELETE FROM buyingstores WHERE char_id='%u'",char_id))return false;
 for(const char* table:std::initializer_list<const char*>{schema_config.skillcooldown_db,"party_bookings","char_configs","merchant_configs"}){
  if(!query("DELETE FROM `%s` WHERE char_id='%u'",table,char_id))return false;
 }
 // Relationships must be removed by normal char-server routines, including
 // their online cache notifications, before the last character row disappears.
 uint64 guild_members=0,party=0;
 if(!scalar(guild_members,"SELECT COUNT(*) FROM `%s` WHERE char_id='%u'",schema_config.guild_member_db,char_id)||guild_members)return false;
 if(!scalar(party,"SELECT party_id FROM `%s` WHERE char_id='%u'",schema_config.char_db,char_id)||party)return false;
 return true;
}
void admin_delete_map_disconnected(int32 server_id) {
 if(server_id<0||server_id>=MAX_MAP_SERVERS)return;
 // File descriptors can be reused. A replacement connection must acknowledge
 // its own save fence even if it receives the same descriptor as the old one.
 barrier.acknowledged[server_id]=false;
 barrier.connections[server_id]=-1;
}
int32 admin_delete_fence_ack(int32 fd,int32 server_id) {
 if(RFIFOREST(fd)<14)return 0;
 const uint32 id=RFIFOL(fd,2);const uint64 nonce=RFIFOQ(fd,6);RFIFOSKIP(fd,14);
 if(server_id>=0&&server_id<MAX_MAP_SERVERS&&id==barrier.account_id&&nonce==barrier.nonce&&barrier.expected[server_id]&&barrier.connections[server_id]==fd)barrier.acknowledged[server_id]=true;
 return 1;
}
bool admin_delete_init() {
 if(!query("SELECT account_id FROM happyro_admin_account_deletions LIMIT 0")||!query("SELECT worker_name FROM happyro_admin_workers LIMIT 0")){
  ShowError("HappyRO administration schema is missing; prepare the game database before starting char-server.\n");return false;
 }
 if(!owns_worker_lock()){ShowError("Another character server owns the account deletion worker.\n");return false;}
 add_timer_func_list(process_deletions,"happyro_account_deletions");
 add_timer_interval(gettick()+1000,process_deletions,0,0,1000);
 return true;
}
