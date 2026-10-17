// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#include "encore.hpp"

#include "map/clif.hpp"
#include "map/pc.hpp"

SkillEncore::SkillEncore() : SkillImpl(BD_ENCORE) {
}

void SkillEncore::castendNoDamageId(block_list *src, block_list *target, uint16 skill_lv, t_tick tick, int32& flag) const {
	map_session_data* sd = BL_CAST( BL_PC, src );

	if (sd == nullptr)
		return;

	const uint16 replay_lv = min(sd->skill_lv_dance, pc_checkskill(sd, sd->skill_id_dance));
	if (replay_lv == 0) {
		clif_skill_fail(*sd, getSkillId());
		return;
	}

	clif_skill_nodamage(src, *target, getSkillId(), skill_lv);
	unit_skilluse_id(src, src->id, sd->skill_id_dance, replay_lv);
}
