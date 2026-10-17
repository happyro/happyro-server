#include <cassert>
#include <cstdint>
#include <iostream>
#include <string>
#include <nlohmann/json.hpp>
#include "common/character_appearance.hpp"
#include "common/mmo.hpp"
#include "map/game_control_appearance.hpp"
constexpr int AREA = 1, CSAVE_NORMAL = 0;
struct map_session_data {
 struct { int class_ = JOB_ARCH_MAGE, sex = SEX_MALE, char_id = 42; int zeny = 1200; } status;
 struct { int id = 0; } trade_partner;
 struct { bool storage_flag = false, vending = false, buyingstore = false; } state;
 int npc_id = 0;
 bool dead = false;
 int64_t appearance = 0;
 int writes = 0, saves = 0, broadcasts = 0;
 // Gameplay sentinels are deliberately distinct from the saved appearance.
 int skill = 37, equipment = 1201, riding = 0, companion = 12;
};
const char* add_str(const char* name) { assert(std::string(name) == "HappyRO_CharacterAppearance"); return name; }
int64_t pc_readglobalreg(map_session_data* sd, const char*) { return sd->appearance; }
void pc_setglobalreg(map_session_data* sd, const char*, int64_t value) { sd->appearance = value; ++sd->writes; }
bool pc_isdead(map_session_data* sd) { return sd->dead; }
void clif_character_appearance(map_session_data* sd, map_session_data* recipient, int target) {
 assert(sd == recipient && target == AREA); ++sd->broadcasts;
}
void chrif_save(map_session_data* sd, int target) { assert(target == CSAVE_NORMAL); ++sd->saves; }
