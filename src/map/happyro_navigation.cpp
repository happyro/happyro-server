#include "happyro_navigation.hpp"
#include "happyro_default_arrivals.hpp"

#include <algorithm>
#include <cstdlib>
#include <common/strlib.hpp>
#include <common/random.hpp>
#include <common/timer.hpp>
#include "atcommand.hpp"
#include "battle.hpp"
#include "clif.hpp"
#include "log.hpp"
#include "map_channel.hpp"
#include "npc.hpp"
#include "pc.hpp"
#include "path.hpp"
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

// Avoid the entire OnTouch area (including warps), plus a two-cell margin.
static bool happyro_safe_arrival_cell(int16 m, int16 x, int16 y){
	const auto* data = map_getmapdata(m);
	if (data == nullptr || x < 1 || y < 1 || x >= data->xs - 1 || y >= data->ys - 1
		|| !map_cell_free(m, x, y, BL_CHAR | BL_NPC))
		return false;
	for (int16 cy = std::max(0, y - 2); cy <= std::min<int>(data->ys - 1, y + 2); ++cy)
		for (int16 cx = std::max(0, x - 2); cx <= std::min<int>(data->xs - 1, x + 2); ++cx)
			if (map_getcell(m, cx, cy, CELL_CHKNPC))
				return false;
	return true;
}

static bool happyro_find_safe_arrival(int16 m, int16& x, int16& y, int max_radius = 12, bool require_connected = false){
	const int16 origin_x = x, origin_y = y;
	if (require_connected && map_getcell(m, x, y, CELL_CHKNOPASS)) return false;
	for (int radius = 0; radius <= max_radius; ++radius) {
		for (int offset = -radius; offset <= radius; ++offset) {
			const int16 candidates[][2] = {
				{static_cast<int16>(origin_x + offset), static_cast<int16>(origin_y - radius)},
				{static_cast<int16>(origin_x + offset), static_cast<int16>(origin_y + radius)},
				{static_cast<int16>(origin_x - radius), static_cast<int16>(origin_y + offset)},
				{static_cast<int16>(origin_x + radius), static_cast<int16>(origin_y + offset)},
			};
			for (const auto& cell : candidates) {
				if (happyro_safe_arrival_cell(m, cell[0], cell[1])
					&& (!require_connected || path_search(nullptr, m, origin_x, origin_y, cell[0], cell[1], 0, CELL_CHKNOPASS))) {
					x = cell[0];
					y = cell[1];
					return true;
				}
			}
		}
	}
	return false;
}

static bool happyro_npc_arrival_cell(const npc_data& npc, int16& x, int16& y, int16 min_radius, int16 max_radius, bool require_connected = false){
	for (int16 radius = min_radius; radius <= max_radius; ++radius) {
		for (int16 offset_y = -radius; offset_y <= radius; ++offset_y) {
			for (int16 offset_x = -radius; offset_x <= radius; ++offset_x) {
				if (std::abs(offset_x) != radius && std::abs(offset_y) != radius)
					continue;
				x = npc.x + offset_x;
				y = npc.y + offset_y;
				if (happyro_safe_arrival_cell(npc.m, x, y)
					&& (!require_connected || path_search(nullptr, npc.m, npc.x, npc.y, x, y, 0, CELL_CHKNOPASS)))
					return true;
			}
		}
	}
	return false;
}

// Walking to an NPC still ends within interaction range.
bool happyro_npc_adjacent_cell(const npc_data& npc, int16& x, int16& y){
	return happyro_npc_arrival_cell(npc, x, y, 1, 3);
}

// Random warps must never use city/service/entrance defaults.
static bool happyro_random_arrival(int16 m, int16& x, int16& y){
	const auto* data = map_getmapdata(m);
	if (data == nullptr || data->xs < 3 || data->ys < 3) return false;
	for (int attempt = 0; attempt < 1000; ++attempt) {
		x = rnd_value(1, data->xs - 2);
		y = rnd_value(1, data->ys - 2);
		if (happyro_safe_arrival_cell(m, x, y)) return true;
	}
	return false;
}

// A (0,0) map request asks the server to choose the default arrival.
static bool happyro_default_arrival(map_session_data* sd, int16 m, const char* map, int16& x, int16& y, bool preview = false){
	for (const auto& entry : happyro_city_arrivals) {
		if (std::strcmp(map, entry.map) != 0) continue;
		x = entry.x;
		y = entry.y;
		return happyro_find_safe_arrival(m, x, y);
	}
	for (const auto& entry : happyro_service_arrivals) {
		if (std::strcmp(map, entry.map) != 0) continue;
		const auto* npc = npc_name2id(entry.npc);
		if (npc == nullptr || npc->m != m || npc->is_invisible || (npc->sc.option & OPTION_HIDE) != 0
			|| npc_is_cloaked(npc, sd) || npc_is_hidden_dynamicnpc(*npc, *sd)) continue;
		if (happyro_npc_arrival_cell(*npc, x, y, 2, 6, entry.require_connected)) return true;
	}
	for (const auto& entry : happyro_entrance_arrivals) {
		if (std::strcmp(map, entry.map) != 0) continue;
		x = entry.x;
		y = entry.y;
		// An unavailable entrance must not send the player to a different room.
		return happyro_find_safe_arrival(m, x, y, 12, true);
	}
	const auto* data = map_getmapdata(m);
	if (data == nullptr) return false;
	x = data->xs / 2;
	y = data->ys / 2;
	return happyro_find_safe_arrival(m, x, y, preview ? 24 : std::max(data->xs, data->ys));
}

HappyroNavigationResult happyro_npc_teleport(map_session_data* sd, const char* requested_map, uint16 requested_x, uint16 requested_y, int32 npc_class){
	if (!happyro_navigation_teleport_allowed(sd)) {
		return {HAPPYRO_NPC_TELEPORT_DISABLED};
	}
	// pc_setpos queues rewarp instead of sending a change-map packet while the
	// player is unspawned. A new navigation action must not report that as arrival.
	if (sd->prev == nullptr || !sd->state.active || !sd->state.pc_loaded || sd->state.warping) {
		return {HAPPYRO_NPC_TELEPORT_MAP_NOT_READY};
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
	if (!happyro_npc_arrival_cell(*lookup.npc, x, y, 2, 6)) {
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

static HappyroNavigationResult happyro_map_destination(map_session_data* sd, const char* requested_map, uint16 requested_x, uint16 requested_y, bool preview){
	if (preview) {
		const auto now = gettick();
		if (sd->navigation_preview_tick != 0 && DIFF_TICK(now, sd->navigation_preview_tick) < 500)
			return {HAPPYRO_MAP_TELEPORT_COOLDOWN};
		sd->navigation_preview_tick = now;
	}
	if (!happyro_navigation_teleport_allowed(sd)) {
		return {HAPPYRO_MAP_TELEPORT_DISABLED};
	}
	// A close packet is not a cancellation: STOP can be next/close2 and resumes
	// the script. Never close or resume a dialogue as a side effect of teleport.
	// npc_shopid is deliberately excluded: it can outlive a closed shop window.
	if (!preview && (sd->npc_id != 0 || sd->st != nullptr || sd->progressbar.npc_id != 0)) {
		return {HAPPYRO_MAP_TELEPORT_DIALOGUE_ACTIVE};
	}
	if (!preview && (sd->prev == nullptr || !sd->state.active || !sd->state.pc_loaded || sd->state.warping)) {
		return {HAPPYRO_MAP_TELEPORT_MAP_NOT_READY};
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
	// The reserved uint16 pair distinguishes random warps from default arrivals.
	const bool random_arrival = requested_x == UINT16_MAX && requested_y == UINT16_MAX;
	if (!random_arrival && (requested_x >= mapdata->xs || requested_y >= mapdata->ys)) {
		return {HAPPYRO_MAP_TELEPORT_INVALID_COORDINATE};
	}

	const t_tick tick = gettick();
	const t_tick cooldown = static_cast<t_tick>(battle_config.navigation_teleport_cooldown) * 1000;
	if (!preview && sd->navigation_teleport_tick != 0) {
		const t_tick elapsed = DIFF_TICK(tick, sd->navigation_teleport_tick);
		if (elapsed < cooldown) {
			const uint32 remaining = static_cast<uint32>((cooldown - elapsed + 999) / 1000);
			return {HAPPYRO_MAP_TELEPORT_COOLDOWN,
				map_name, 0, 0, remaining};
		}
	}

	int16 x = random_arrival ? 0 : requested_x;
	int16 y = random_arrival ? 0 : requested_y;
	if (random_arrival) {
		if (!happyro_random_arrival(map_id, x, y))
			return {HAPPYRO_MAP_TELEPORT_NO_SAFE_CELL};
	} else if (x == 0 && y == 0) {
		if (!happyro_default_arrival(sd, map_id, map_name, x, y, preview))
			return {HAPPYRO_MAP_TELEPORT_NO_SAFE_CELL};
	} else if (!happyro_find_safe_arrival(map_id, x, y)) {
		return {HAPPYRO_MAP_TELEPORT_NO_SAFE_CELL};
	}
	if (preview) return {HAPPYRO_MAP_TELEPORT_SUCCESS, map_name, static_cast<uint16>(x), static_cast<uint16>(y)};
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

HappyroNavigationResult happyro_map_teleport(map_session_data* sd, const char* map, uint16 x, uint16 y){
	return happyro_map_destination(sd, map, x, y, false);
}
HappyroNavigationResult happyro_map_arrival_preview(map_session_data* sd, const char* map){
	return happyro_map_destination(sd, map, 0, 0, true);
}
