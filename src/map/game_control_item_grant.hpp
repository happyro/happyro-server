// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#ifndef HAPPYRO_GAME_CONTROL_ITEM_GRANT_HPP
#define HAPPYRO_GAME_CONTROL_ITEM_GRANT_HPP

#include <nlohmann/json.hpp>

struct map_session_data;

struct GameControlItemGrantResult {
	int status;
	nlohmann::json body;
};

GameControlItemGrantResult game_control_grant_inventory_item(
	map_session_data* sd,
	const nlohmann::json& payload
);

#endif
