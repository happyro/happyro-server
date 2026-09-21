#ifndef HAPPYRO_GAME_CONTROL_NAVIGATION_HPP
#define HAPPYRO_GAME_CONTROL_NAVIGATION_HPP

#include <nlohmann/json.hpp>

struct map_session_data;
struct GameControlNavigationResult {
	int status;
	nlohmann::json body;
};

GameControlNavigationResult game_control_teleport(map_session_data* sd, const nlohmann::json& payload);
GameControlNavigationResult game_control_route(map_session_data* sd, const nlohmann::json& payload);

#endif
