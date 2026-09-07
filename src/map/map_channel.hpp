// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#ifndef MAP_MAP_CHANNEL_HPP
#define MAP_MAP_CHANNEL_HPP

#include <cstddef>
#include <cstring>

#include <common/strlib.hpp>

inline const char* map_channel_canonical_name(const char* map_name) {
	static constexpr const char* aliases[][2] = {
		{"iz_int01", "iz_int"},
		{"iz_int02", "iz_int"},
		{"iz_int03", "iz_int"},
		{"iz_int04", "iz_int"},
		{"int_land01", "int_land"},
		{"int_land02", "int_land"},
		{"int_land03", "int_land"},
		{"int_land04", "int_land"},
		{"izlude_a", "izlude"},
		{"izlude_b", "izlude"},
		{"izlude_c", "izlude"},
		{"izlude_d", "izlude"},
		{"prt_fild08a", "prt_fild08"},
		{"prt_fild08b", "prt_fild08"},
		{"prt_fild08c", "prt_fild08"},
		{"prt_fild08d", "prt_fild08"},
		{"iz_ac01_a", "iz_ac01"},
		{"iz_ac01_b", "iz_ac01"},
		{"iz_ac01_c", "iz_ac01"},
		{"iz_ac01_d", "iz_ac01"},
		{"iz_ac02_a", "iz_ac02"},
		{"iz_ac02_b", "iz_ac02"},
		{"iz_ac02_c", "iz_ac02"},
		{"iz_ac02_d", "iz_ac02"},
	};

	for (const auto& alias : aliases) {
		if (std::strcmp(map_name, alias[0]) == 0)
			return alias[1];
	}
	return map_name;
}

inline void map_channel_normalize_name(char* map_name, std::size_t size) {
	const char* canonical_name = map_channel_canonical_name(map_name);
	if (canonical_name != map_name)
		safestrncpy(map_name, canonical_name, size);
}

#endif // MAP_MAP_CHANNEL_HPP
