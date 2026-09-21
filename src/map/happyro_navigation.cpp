#include "happyro_navigation.hpp"

#include <algorithm>
#include <cstdlib>
#include <common/strlib.hpp>
#include <common/timer.hpp>
#include "atcommand.hpp"
#include "battle.hpp"
#include "clif.hpp"
#include "log.hpp"
#include "map_channel.hpp"
#include "npc.hpp"
#include "pc.hpp"
#include "pc_groups.hpp"
#include "unit.hpp"

bool happyro_navigation_teleport_allowed( const map_session_data* sd ){
	return battle_config.navigation_teleport_policy == 2
		|| (battle_config.navigation_teleport_policy == 1 && pc_can_use_command(sd, "mapmove", COMMAND_ATCOMMAND));
}

struct s_happyro_npc_lookup {
	map_session_data* sd;
	int32 npc_class;
	int16 expected_x;
	int16 expected_y;
	npc_data* npc = nullptr;
	int32 distance = INT32_MAX;
};

static int32 happyro_find_navigation_npc( block_list* bl, va_list args ){
	auto* lookup = va_arg(args, s_happyro_npc_lookup*);
	auto* nd = reinterpret_cast<npc_data*>(bl);
	if (nd->class_ != lookup->npc_class || nd->is_invisible
		|| (nd->sc.option & OPTION_HIDE) != 0 || npc_is_cloaked(nd, lookup->sd)
		|| npc_is_hidden_dynamicnpc(*nd, *lookup->sd)) {
		return 0;
	}

	const int32 distance = std::abs(nd->x - lookup->expected_x) + std::abs(nd->y - lookup->expected_y);
	if (distance < lookup->distance) {
		lookup->npc = nd;
		lookup->distance = distance;
	}
	return 1;
}

npc_data* happyro_navigation_npc( map_session_data* sd, const char* requested_map,
	uint16 expected_x, uint16 expected_y, int32 npc_class ){
	char map_name[MAP_NAME_LENGTH_EXT];
	safestrncpy(map_name, requested_map, sizeof(map_name));
	if (!battle_config.navigation_map_channels_enabled)
		map_channel_normalize_name(map_name, sizeof(map_name));
	const uint16 mapindex = mapindex_name2idx(map_name, nullptr);
	const int16 map_id = mapindex == 0 ? -1 : map_mapindex2mapid(mapindex);
	const map_data* mapdata = map_id < 0 ? nullptr : map_getmapdata(map_id);
	if (mapdata == nullptr || npc_class <= 0 || expected_x >= mapdata->xs || expected_y >= mapdata->ys)
		return nullptr;

	s_happyro_npc_lookup lookup{sd, npc_class, static_cast<int16>(expected_x), static_cast<int16>(expected_y)};
	map_foreachinarea(happyro_find_navigation_npc, map_id,
		std::max<int16>(0, lookup.expected_x - 2), std::max<int16>(0, lookup.expected_y - 2),
		lookup.expected_x + 2, lookup.expected_y + 2, BL_NPC, &lookup);
	return lookup.npc;
}

bool happyro_npc_adjacent_cell( const npc_data& npc, int16& x, int16& y ){
	for (int16 radius = 1; radius <= 3; ++radius) {
		for (int16 offset_y = -radius; offset_y <= radius; ++offset_y) {
			for (int16 offset_x = -radius; offset_x <= radius; ++offset_x) {
				if (std::abs(offset_x) != radius && std::abs(offset_y) != radius)
					continue;
				x = npc.x + offset_x;
				y = npc.y + offset_y;
				if (map_cell_free(npc.m, x, y, BL_CHAR | BL_NPC))
					return true;
			}
		}
	}
	return false;
}

HappyroNavigationResult happyro_npc_teleport(map_session_data* sd, const char* requested_map, uint16 requested_x, uint16 requested_y, int32 npc_class){
	if (!happyro_navigation_teleport_allowed(sd)) {
		return {HAPPYRO_NPC_TELEPORT_DISABLED};
	}

	char map_name[MAP_NAME_LENGTH_EXT];
	safestrncpy(map_name, requested_map, sizeof(map_name));
	if (!battle_config.navigation_map_channels_enabled)
		map_channel_normalize_name(map_name, sizeof(map_name));
	const uint16 mapindex = mapindex_name2idx(map_name, nullptr);
	const int16 map_id = mapindex == 0 ? -1 : map_mapindex2mapid(mapindex);
	const map_data* mapdata = map_id < 0 ? nullptr : map_getmapdata(map_id);
	if (mapdata == nullptr || npc_class <= 0 || requested_x >= mapdata->xs || requested_y >= mapdata->ys) {
		return {HAPPYRO_NPC_TELEPORT_INVALID_MAP};
	}
	if (!battle_config.navigation_teleport_cross_map && mapindex != sd->mapindex) {
		return {HAPPYRO_NPC_TELEPORT_CROSS_MAP_DISABLED};
	}
	if ((map_getmapflag(map_id, MF_NOWARPTO) && !pc_has_permission(sd, PC_PERM_WARP_ANYWHERE))
		|| !pc_job_can_entermap(static_cast<enum e_job>(sd->status.class_), map_id, pc_get_group_level(sd))
		|| (sd->m >= 0 && map_getmapflag(sd->m, MF_NOWARP) && !pc_has_permission(sd, PC_PERM_WARP_ANYWHERE))) {
		return {HAPPYRO_NPC_TELEPORT_MAP_FORBIDDEN};
	}

	s_happyro_npc_lookup lookup{sd, npc_class, static_cast<int16>(requested_x), static_cast<int16>(requested_y)};
	map_foreachinarea(happyro_find_navigation_npc, map_id,
		std::max<int16>(0, lookup.expected_x - 2), std::max<int16>(0, lookup.expected_y - 2),
		lookup.expected_x + 2, lookup.expected_y + 2, BL_NPC, &lookup);
	if (lookup.npc == nullptr) {
		return {HAPPYRO_NPC_TELEPORT_NPC_UNAVAILABLE};
	}

	const t_tick tick = gettick();
	const t_tick cooldown = static_cast<t_tick>(battle_config.navigation_teleport_cooldown) * 1000;
	if (sd->navigation_teleport_tick != 0) {
		const t_tick elapsed = DIFF_TICK(tick, sd->navigation_teleport_tick);
		if (elapsed < cooldown) {
			const uint32 remaining = static_cast<uint32>((cooldown - elapsed + 999) / 1000);
			return {HAPPYRO_NPC_TELEPORT_COOLDOWN,
				map_name, 0, 0, remaining};
		}
	}

	int16 x = lookup.npc->x;
	int16 y = lookup.npc->y;
	if (!happyro_npc_adjacent_cell(*lookup.npc, x, y)) {
		return {HAPPYRO_NPC_TELEPORT_NO_CELL};
	}
	if (pc_setpos(sd, mapindex, x, y, CLR_TELEPORT) != SETPOS_OK) {
		return {HAPPYRO_NPC_TELEPORT_FAILED};
	}

	sd->navigation_teleport_tick = tick;
	unit_setdir(sd, map_calc_dir(sd, lookup.npc->x, lookup.npc->y));
	char command[CHAT_SIZE_MAX];
	safesnprintf(command, sizeof(command), "%cnpcwarp %s %d %d", atcommand_symbol, map_name, lookup.npc->x, lookup.npc->y);
	log_atcommand(sd, command);
	return {HAPPYRO_NPC_TELEPORT_SUCCESS,
		map_name, static_cast<uint16>(x), static_cast<uint16>(y), static_cast<uint32>(battle_config.navigation_teleport_cooldown)};
}

HappyroNavigationResult happyro_map_teleport(map_session_data* sd, const char* requested_map, uint16 requested_x, uint16 requested_y){
	if (!happyro_navigation_teleport_allowed(sd)) {
		return {HAPPYRO_MAP_TELEPORT_DISABLED};
	}

	char map_name[MAP_NAME_LENGTH_EXT];
	safestrncpy(map_name, requested_map, sizeof(map_name));
	if (!battle_config.navigation_map_channels_enabled)
		map_channel_normalize_name(map_name, sizeof(map_name));
	const uint16 mapindex = mapindex_name2idx(map_name, nullptr);
	const int16 map_id = mapindex == 0 ? -1 : map_mapindex2mapid(mapindex);
	const map_data* mapdata = map_id < 0 ? nullptr : map_getmapdata(map_id);
	if (mapdata == nullptr) {
		return {HAPPYRO_MAP_TELEPORT_INVALID_MAP};
	}
	if (!battle_config.navigation_teleport_cross_map && mapindex != sd->mapindex) {
		return {HAPPYRO_MAP_TELEPORT_CROSS_MAP_DISABLED};
	}
	if ((map_getmapflag(map_id, MF_NOWARPTO) && !pc_has_permission(sd, PC_PERM_WARP_ANYWHERE))
		|| !pc_job_can_entermap(static_cast<enum e_job>(sd->status.class_), map_id, pc_get_group_level(sd))
		|| (sd->m >= 0 && map_getmapflag(sd->m, MF_NOWARP) && !pc_has_permission(sd, PC_PERM_WARP_ANYWHERE))) {
		return {HAPPYRO_MAP_TELEPORT_MAP_FORBIDDEN};
	}
	if ((requested_x != 0 || requested_y != 0) && (requested_x >= mapdata->xs || requested_y >= mapdata->ys)) {
		return {HAPPYRO_MAP_TELEPORT_INVALID_COORDINATE};
	}

	const t_tick tick = gettick();
	const t_tick cooldown = static_cast<t_tick>(battle_config.navigation_teleport_cooldown) * 1000;
	if (sd->navigation_teleport_tick != 0) {
		const t_tick elapsed = DIFF_TICK(tick, sd->navigation_teleport_tick);
		if (elapsed < cooldown) {
			const uint32 remaining = static_cast<uint32>((cooldown - elapsed + 999) / 1000);
			return {HAPPYRO_MAP_TELEPORT_COOLDOWN,
				map_name, 0, 0, remaining};
		}
	}

	int16 x = requested_x;
	int16 y = requested_y;
	if ((x != 0 || y != 0) && map_getcell(map_id, x, y, CELL_CHKNOPASS)
		&& !map_search_freecell(nullptr, map_id, &x, &y, 10, 10, 1)) {
		x = 0;
		y = 0;
	}
	if (pc_setpos(sd, mapindex, x, y, CLR_TELEPORT) != SETPOS_OK) {
		return {HAPPYRO_MAP_TELEPORT_FAILED};
	}
	sd->navigation_teleport_tick = tick;
	char command[CHAT_SIZE_MAX];
	safesnprintf(command, sizeof(command), "%cmapmove %s %hu %hu", atcommand_symbol, map_name, requested_x, requested_y);
	log_atcommand(sd, command);
	return {HAPPYRO_MAP_TELEPORT_SUCCESS,
		map_name, static_cast<uint16>(sd->x), static_cast<uint16>(sd->y), static_cast<uint32>(battle_config.navigation_teleport_cooldown)};
}
