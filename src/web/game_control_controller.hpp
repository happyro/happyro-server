// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#ifndef GAME_CONTROL_CONTROLLER_HPP
#define GAME_CONTROL_CONTROLLER_HPP

#include "http.hpp"

HANDLER_FUNC(game_control_capabilities);
HANDLER_FUNC(game_control_battle_config);
HANDLER_FUNC(game_control_command);

bool game_control_config_is_valid();

#endif
