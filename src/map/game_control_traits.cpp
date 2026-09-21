// Copyright (c) HappyRO - Licensed under GNU GPL
#include "game_control_traits.hpp"

#include <array>
#include <algorithm>
#include <climits>
#include "battle.hpp"
#include "clif.hpp"
#include "pc.hpp"
#include "status.hpp"

namespace {
constexpr int32 maintenance_trait_max = SHRT_MAX;
constexpr std::array<const char*, 6> names = {"pow", "sta", "wis", "spl", "con", "crt"};

uint32 budget(const map_session_data* sd) {
	return pc_is_trait_job(sd->class_)
		? statpoint_db.get_trait_table_point(sd->status.base_level) + battle_config.trait_points_job_change : 0;
}

void refresh(map_session_data* sd) {
	for (int i = 0; i < names.size(); ++i) {
		clif_updatestatus(*sd, static_cast<_sp>(SP_POW + i));
		clif_updatestatus(*sd, static_cast<_sp>(SP_UPOW + i));
	}
	clif_updatestatus(*sd, SP_TRAITPOINT);
	status_calc_pc(sd, SCO_FORCE);
}
}

nlohmann::json game_control_traits_snapshot(const map_session_data* sd) {
	nlohmann::json values, maximums;
	for (int i = 0; i < names.size(); ++i) {
		values[names[i]] = pc_getstat(sd, SP_POW + i);
		maximums[names[i]] = maintenance_trait_max;
	}
	return {{"enabled", static_cast<bool>(pc_is_trait_job(sd->class_))}, {"values", values},
		{"maximums", maximums}, {"points", sd->status.trait_point}, {"budget", budget(sd)}};
}

bool game_control_traits_update(map_session_data* sd, const nlohmann::json& payload) {
	if (!pc_is_trait_job(sd->class_) || !payload.is_object() || payload.empty())
		return false;
	std::array<int32, 6> values;
	for (int i = 0; i < names.size(); ++i)
		values[i] = pc_getstat(sd, SP_POW + i);
	for (const auto& [key, value] : payload.items()) {
		auto it = std::find(names.begin(), names.end(), key);
		if (it == names.end() || !value.is_number_integer())
			return false;
		const int i = it - names.begin();
		if (value < 0 || value > maintenance_trait_max)
			return false;
		values[i] = value.get<int32>();
	}
	for (int i = 0; i < names.size(); ++i)
		pc_setstat(sd, SP_POW + i, values[i]);
	// Maintenance sets attributes directly without spending unallocated points.
	refresh(sd);
	return true;
}

void game_control_traits_reconcile(map_session_data* sd, bool reset) {
	uint32 used = 0;
	for (int i = 0; i < names.size(); ++i)
		used += pc_getstat(sd, SP_POW + i);
	if (reset || !pc_is_trait_job(sd->class_)) {
		for (int i = 0; i < names.size(); ++i)
			pc_setstat(sd, SP_POW + i, 0);
		used = 0;
	}
	sd->status.trait_point = used < budget(sd) ? budget(sd) - used : 0;
	refresh(sd);
}

void game_control_base_stats_reset(map_session_data* sd) {
	sd->status.status_point = statpoint_db.get_table_point(sd->status.base_level);
	if ((sd->class_ & JOBL_UPPER) || pc_is_primary_fourth(sd->class_))
		sd->status.status_point += battle_config.transcendent_status_points;
	for (int i = 0; i < 6; ++i) {
		pc_setstat(sd, SP_STR + i, 1);
		clif_updatestatus(*sd, static_cast<_sp>(SP_STR + i));
		clif_updatestatus(*sd, static_cast<_sp>(SP_USTR + i));
	}
	clif_updatestatus(*sd, SP_STATUSPOINT);
	status_calc_pc(sd, SCO_FORCE);
}
