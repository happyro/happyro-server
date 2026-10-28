#include <cassert>
#include <cstdint>
#include <cstdio>
#include <map>
#include <memory>
using int32=int32_t;using uint8=uint8_t;using uint32=uint32_t;using uint64=uint64_t;
constexpr int MAX_INVENTORY=10;
#define RENEWAL
#define nullpo_retr(value,p) if(!(p))return value
#define DIFF_TICK(a,b) ((a)-(b))
constexpr int ITEM_EQUIP_ACK_OK=0,ITEM_EQUIP_ACK_FAIL=1,ITEM_EQUIP_ACK_FAILLEVEL=2;
constexpr int PC_PERM_USE_ALL_EQUIPMENT=1,SL_SUPERNOVICE=1,SEX_BOTH=2;
constexpr int MAPID_FIRSTMASK=0xff,JOBL_2_1=0x100,JOBL_2_2=0x200,JOBL_UPPER=0x400,JOBL_BABY=0x800,JOBL_THIRD=0x1000,JOBL_FOURTH=0x2000;
constexpr int ITEMJ_NORMAL=1,ITEMJ_UPPER=2,ITEMJ_BABY=4,ITEMJ_THIRD=8,ITEMJ_THIRD_UPPER=16,ITEMJ_THIRD_BABY=32,ITEMJ_FOURTH=64;
constexpr int EQP_HAND_R=2,EQP_SHIELD=32,EQP_ARMS=34,EQP_ARMOR=16,EQP_HEAD_TOP=256,EQP_HELM=256,EQP_ACC_L=8,EQP_ACC_R=128,EQP_ACC=136,EQP_AMMO=32768,EQP_SHADOW_GEAR=65536;
constexpr int IT_WEAPON=1,IT_ARMOR=2,IT_AMMO=3;
enum { W_DAGGER,W_1HSWORD,W_1HAXE,W_2HAXE,W_MACE,W_STAFF,W_2HSTAFF,W_BOW,W_MUSICAL,W_WHIP,W_REVOLVER,W_RIFLE,W_GATLING,W_SHOTGUN,W_GRENADE };
enum {AMMO_ARROW,AMMO_DAGGER,AMMO_BULLET,AMMO_SHELL,AMMO_CANNONBALL};
enum {SC_SPIRIT,SC_STRIPWEAPON,SC_STRIPSHIELD,SC_STRIPARMOR,SC_STRIPHELM,SC__STRIPACCESSORY,SC__WEAKNESS,SC_SHADOW_STRIP,SC_KYOUGAKU,SC_SUHIDE,SC_PYROCLASTIC};
enum e_clif_messages {MSI_FAIL_NEED_EQUIPPED_BOW=1,MSI_WRONG_BULLET,MSI_USESKILL_FAIL_MADOGEAR,MSI_USESKILL_FAIL_CART};
constexpr int JOB_MECHANIC_T=10,JOB_MECHANIC=11,JOB_GENETIC_T=12,JOB_GENETIC=13,AS_VENOMKNIFE=1,PCBLOCK_EQUIP=1;
struct item_data { int equip=EQP_ARMOR,type=IT_ARMOR,subtype=0,weapon_level=0,elv=0,elvmax=0,sex=SEX_BOTH,slots=0; uint64 class_base[3]={~0ULL,~0ULL,~0ULL};int class_upper=ITEMJ_NORMAL; };
struct item {int nameid=2301,amount=1,equip=0,identify=1,attribute=0;int card[4]={};};
struct Effect {int val2=0;};
struct Effects {std::map<int,Effect> values;struct{bool equip=false;}cant;int opt1=0;bool empty()const{return values.empty()&&!cant.equip;} const Effect* getSCE(int id)const{auto p=values.find(id);return p==values.end()?nullptr:&p->second;} };
struct map_session_data {item_data* inventory_data[MAX_INVENTORY]={};struct{struct{item items_inventory[MAX_INVENTORY];}u;}inventory;struct{uint32 base_level=50;int sex=0,class_=0,weapon=0;}status;struct{bool active=true,storage_flag=false;int block_action=0;}state;Effects sc;int class_=0,m=0,npc_id=0;bool npc_item_flag=false,gm=false,mado=false,cart=false,skill=false,dead=false,cant=false;int canequip_tick=0;};
struct {bool allow_equip_restricted_item=false,ammo_check_weapon=true;}battle_config;
struct {std::map<int,std::shared_ptr<item_data>> items;std::shared_ptr<item_data>find(int id){auto p=items.find(id);return p==items.end()?nullptr:p->second;}}item_db;
int messages=0;bool noEquip=false;
bool pc_has_permission(const map_session_data*sd,int){return sd->gm;}
bool itemdb_isNoEquip(const item_data*,int){return noEquip;}
bool pc_checkskill(const map_session_data*sd,int){return sd->skill;}
bool pc_ismadogear(const map_session_data*sd){return sd->mado;}
bool pc_iscarton(const map_session_data*sd){return sd->cart;}
bool itemdb_isequip2(const item_data*id){return id->type==IT_ARMOR||id->type==IT_WEAPON||id->type==IT_AMMO;}
int pc_equippoint(const map_session_data*sd,int n){return sd->inventory_data[n]->equip;}
void clif_msg(const map_session_data&,e_clif_messages){messages++;}
bool pc_isdead(map_session_data*sd){return sd->dead;}
bool pc_cant_act2(map_session_data*sd){return sd->cant;}
int gettick(){return 100;}
