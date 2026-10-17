#ifndef HAPPYRO_GAME_CONTROL_APPEARANCE_HPP
#define HAPPYRO_GAME_CONTROL_APPEARANCE_HPP
#include <nlohmann/json.hpp>
struct map_session_data;
struct GameControlAppearanceResult {
 int status;
 nlohmann::json body;
};
int game_control_character_appearance(map_session_data* sd);
void game_control_character_appearance_reconcile(map_session_data* sd);
nlohmann::json game_control_character_appearance_snapshot(map_session_data* sd);
GameControlAppearanceResult game_control_character_appearance_update(map_session_data* sd, const nlohmann::json& payload);
#endif
