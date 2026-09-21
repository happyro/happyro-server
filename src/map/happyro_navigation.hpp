#ifndef HAPPYRO_NAVIGATION_HPP
#define HAPPYRO_NAVIGATION_HPP

#include <string>
#include <common/cbasetypes.hpp>

class map_session_data;
struct npc_data;

enum e_happyro_npc_teleport_result : uint16 {
	HAPPYRO_NPC_TELEPORT_SUCCESS = 0,
	HAPPYRO_NPC_TELEPORT_DISABLED,
	HAPPYRO_NPC_TELEPORT_CROSS_MAP_DISABLED,
	HAPPYRO_NPC_TELEPORT_COOLDOWN,
	HAPPYRO_NPC_TELEPORT_INVALID_MAP,
	HAPPYRO_NPC_TELEPORT_NPC_UNAVAILABLE,
	HAPPYRO_NPC_TELEPORT_MAP_FORBIDDEN,
	HAPPYRO_NPC_TELEPORT_NO_CELL,
	HAPPYRO_NPC_TELEPORT_FAILED,
};

enum e_happyro_map_teleport_result : uint16 {
	HAPPYRO_MAP_TELEPORT_SUCCESS = 0,
	HAPPYRO_MAP_TELEPORT_DISABLED,
	HAPPYRO_MAP_TELEPORT_CROSS_MAP_DISABLED,
	HAPPYRO_MAP_TELEPORT_COOLDOWN,
	HAPPYRO_MAP_TELEPORT_INVALID_MAP,
	HAPPYRO_MAP_TELEPORT_MAP_FORBIDDEN,
	HAPPYRO_MAP_TELEPORT_INVALID_COORDINATE,
	HAPPYRO_MAP_TELEPORT_FAILED,
};

struct HappyroNavigationResult {
	uint16 code;
	std::string map = "";
	uint16 x = 0;
	uint16 y = 0;
	uint32 cooldown = 0;
};

bool happyro_navigation_teleport_allowed(const map_session_data* sd);
npc_data* happyro_navigation_npc(map_session_data* sd, const char* map, uint16 x, uint16 y, int32 npc_class);
HappyroNavigationResult happyro_npc_teleport(map_session_data* sd, const char* map, uint16 x, uint16 y, int32 npc_class);
HappyroNavigationResult happyro_map_teleport(map_session_data* sd, const char* map, uint16 x, uint16 y);
bool happyro_npc_adjacent_cell(const npc_data& npc, int16& x, int16& y);

#endif
