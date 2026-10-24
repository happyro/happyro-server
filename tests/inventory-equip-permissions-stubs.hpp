#include <cassert>
#include <cstdint>
#include <cstdio>
using int32 = int32_t;
constexpr int MAX_INVENTORY = 6;
constexpr int AS_LEFT=1, MAPID_SECONDMASK=255, MAPID_ASSASSIN=12, MAPID_KAGEROUOBORO=20;
constexpr int W_DAGGER=1, W_1HSWORD=2, W_1HAXE=3, W_OTHER=4;
constexpr int EQP_WEAPON=2, EQP_ARMS=34, EQP_SHADOW_WEAPON=131072, EQP_SHADOW_ARMS=393216;
constexpr int SCO_FORCE=1;
struct item_data { int subtype, equip; };
struct item { int nameid=0, equip=0, equipSwitch=0; };
struct map_session_data {
 bool prev=true;
 int class_=6, left_skill=0;
 int8_t inventory_dual_wield=-1;
 unsigned inventory_equip_update_depth=0;
 bool inventory_equip_refreshing=false;
 bool inventory_equip_permissions_changed=false;
 struct { struct { item items_inventory[MAX_INVENTORY]; } u; } inventory;
 item_data* inventory_data[MAX_INVENTORY]{};
 int sends=0, recalcs=0, removed=0, switches_removed=0;
 bool grant_on_remove=false, clear_on_recalc=false;
};
#define nullpo_ret(p) do { if (!(p)) return 0; } while(0)
int pc_checkskill(const map_session_data* sd, int) { return sd->left_skill; }
bool itemdb_isequip2(const item_data*) { return true; }
int32 pc_equippoint_sub(const map_session_data*, const item_data*);
int32 pc_equippoint(const map_session_data*, int32);
bool pc_can_dual_wield(const map_session_data*);
void pc_refresh_inventory_equip_locations(map_session_data*);
bool pc_unequipitem(map_session_data*, int32, int32);
void status_calc_pc(map_session_data*, int);
void pc_equipswitch_remove(map_session_data*, int32);
void clif_inventorylist(map_session_data*);
