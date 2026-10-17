// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#include "retrospection.hpp"

#include "map/clif.hpp"
#include "map/pc.hpp"
#include "map/unit.hpp"

SkillRetrospection::SkillRetrospection() : SkillImpl(TR_RETROSPECTION) {
}

void SkillRetrospection::castendNoDamageId(block_list* src, block_list* target, uint16 skill_lv, t_tick tick, int32& flag) const {
	map_session_data* sd = BL_CAST(BL_PC, src);

	if (sd == nullptr)
		return;

	const uint16 replay_lv = min(sd->skill_lv_song, pc_checkskill(sd, sd->skill_id_song));
	if (replay_lv == 0) {
		clif_skill_fail(*sd, getSkillId());
		return;
	}

	clif_skill_nodamage(src, *target, getSkillId(), skill_lv);
	unit_skilluse_id(src, src->id, sd->skill_id_song, replay_lv);
}
