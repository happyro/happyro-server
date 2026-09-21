// Copyright (c) HappyRO - Licensed under GNU GPL
#include "game_control_skills.hpp"

#include "chrif.hpp"
#include "clif.hpp"
#include "pc.hpp"
#include "skill.hpp"
#include "status.hpp"

int32_t game_control_learn_job_skills(map_session_data* sd) {
	const auto tree = skill_tree_db.find(sd->status.class_);
	if (!tree)
		return 0;

	int32_t learned = 0;
	// loadingFinished has already merged all inherited job skills into this tree.
	// Do not use pc_allskillup: GM permissions can make that grant unrelated jobs.
	for (const auto& entry : tree->skills) {
		const auto id = entry.first;
		const auto index = skill_get_index(id);
		const auto skill = skill_db.find(id);
		if (!index || !skill || !entry.second->max_lv
			|| skill->inf2[INF2_ISWEDDING] || skill->inf2[INF2_ISSPIRIT])
			continue;
		auto& learned_skill = sd->status.skill[index];
		learned_skill.id = id;
		learned_skill.lv = entry.second->max_lv;
		learned_skill.flag = SKILL_FLAG_PERMANENT;
		++learned;
	}
	status_calc_pc(sd, SCO_FORCE);
	clif_skillinfoblock(*sd);
	chrif_save(sd, CSAVE_NORMAL);
	return learned;
}
