#include "game_control_appearance.hpp"
#include <common/character_appearance.hpp>
#include <common/strlib.hpp>
#include "pc.hpp"
#include "clif.hpp"
#include "chrif.hpp"
#include "script.hpp"

namespace {
const char* blocked(map_session_data* sd) {
 if (pc_isdead(sd) || sd->npc_id || sd->trade_partner.id || sd->state.storage_flag || sd->state.vending || sd->state.buyingstore)
  return "appearance_busy";
 return "";
}
}

int game_control_character_appearance(map_session_data* sd) {
 const auto value = pc_readglobalreg(sd, add_str("HappyRO_CharacterAppearance"));
 return character_appearance_allowed(sd->status.class_, value, sd->status.sex) ? static_cast<int>(value) : 0;
}

void game_control_character_appearance_reconcile(map_session_data* sd) {
 const auto key = add_str("HappyRO_CharacterAppearance");
 if (pc_readglobalreg(sd, key) != game_control_character_appearance(sd)) pc_setglobalreg(sd, key, 0);
}

nlohmann::json game_control_character_appearance_snapshot(map_session_data* sd) {
 auto options = nlohmann::json::array();
 const auto* mount = character_appearance_mount(sd->status.class_);
 options.push_back({{"id", 0}, {"name", "默认外观"}, {"mountLabel", mount && mount->mount_label ? mount->mount_label : ""}, {"fallbackOnMount", false}});
 for (const auto& option : character_appearance_data::options) {
  if (!character_appearance_allowed(sd->status.class_, option.id, sd->status.sex)) continue;
  options.push_back({{"id", option.id}, {"name", option.name}, {"mountLabel", option.mount_label ? option.mount_label : ""},
   {"fallbackOnMount", mount && option.mounted_job == 0}});
 }
 return {{"current", game_control_character_appearance(sd)}, {"options", options}, {"reason", blocked(sd)}};
}

GameControlAppearanceResult game_control_character_appearance_update(map_session_data* sd, const nlohmann::json& payload) {
 if (!payload.is_object() || payload.size() != 1 || !payload.contains("appearance")
  || !payload["appearance"].is_number_integer() || payload["appearance"] < 0 || payload["appearance"] > UINT16_MAX)
  return {400, {{"error", {{"code", "invalid_parameter"}}}}};
 const int choice = payload["appearance"].get<int>();
 if (!character_appearance_known(choice)) return {400, {{"error", {{"code", "invalid_parameter"}}}}};
 if (!character_appearance_allowed(sd->status.class_, choice, sd->status.sex))
  return {409, {{"error", {{"code", "appearance_job_required"}}}}};
 const auto reason = blocked(sd);
 if (*reason) return {409, {{"error", {{"code", reason}}}}};
 pc_setglobalreg(sd, add_str("HappyRO_CharacterAppearance"), choice);
 clif_character_appearance(sd, sd, AREA);
 chrif_save(sd, CSAVE_NORMAL);
 return {200, {{"data", {{"result", {{"char_id", sd->status.char_id}, {"characterAppearance", game_control_character_appearance_snapshot(sd)}}}}}}};
}
