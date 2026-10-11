#ifndef HAPPYRO_DEFAULT_ARRIVALS_HPP
#define HAPPYRO_DEFAULT_ARRIVALS_HPP

#include <cstdint>

// Reviewed service NPC allowlist. Order within a map defines preference.
// Resolve names against live NPCs; these are not precomputed landing coordinates.
struct HappyroServiceArrival { const char* map; const char* npc; bool require_connected = false; };
static constexpr HappyroServiceArrival happyro_service_arrivals[] = {
	{"aldeba_in", "Kafra Service"},
	{"pay_arche", "kaf_payon3"},
	{"comodo", "kaf_comodo"},
	{"cmd_fild07", "kaf_cmd_fild07"},
	{"moscovia", "kaf_mosk"},
	{"amatsu", "kaf_amatsu"},
	{"ayothaya", "kaf_ayothaya"},
	{"gonryun", "kaf_gonryun"},
	{"lhz_in02", "kaf_lhz_in02"},
	{"louyang", "kaf_louyang"},
	{"umbala", "kaf_umbala"},
	{"niflheim", "kaf_niflheim"},
	{"izlu2dun", "kaf_izlu2dun"},
	{"prt_fild05", "prt_fild05"},
	{"mjolnir_02", "kaf_mjolnir_02"},
	{"moc_ruins", "moc_ruins"},
	{"gef_fild10", "kaf_gef_fild10"},
	{"alb2trea", "kaf_alb2trea"},
	{"brasilis", "kaf_bra"},
	{"dewata", "kaf_dewata"},
	{"glast_01", "kaf_glast"},
	{"xmas", "kaf_xmas"},
	{"moc_para01", "kaf_eden"},
	{"izlude_a", "Kafra Employee#iz_a"},
	{"izlude_b", "Kafra Employee#iz_b"},
	{"izlude_c", "Kafra Employee#iz_c"},
	{"izlude_d", "Kafra Employee#iz_d"},
	{"malaya", "kaf_malaya1"},
	{"malaya", "kaf_malaya2"},
	{"job3_rune01", "kaf_rune"},
	{"harboro1", "kaf_rock"},
	{"verus04", "CoolEventCorpStaffVerus"},
	{"malangdo", "仓库管理员#mal", true},
	{"mora", "旅馆老板#mora_inn", true},
	{"dali", "后勤管理员", true},
	// Full review batch; manifest: docs/navigation-arrivals-full-pass.json
	{"prt_in", "Inn Employee#Sammy", true},
	{"geffen_in", "Inn Employee#Cena", true},
	{"hu_in01", "Inn Maid#Receptionist", true},
	{"bra_in01", "Hotel Keeper#bra1", true},
	{"ein_in01", "Hotel Employee#ein", true},
	{"mosk_in", "旅馆老板娘#mos", true},
};

struct HappyroCityArrival { const char* map; std::int16_t x; std::int16_t y; };
static constexpr HappyroCityArrival happyro_city_arrivals[] = {
	{"prontera", 149, 89},
	{"geffen", 120, 65},
	{"payon", 181, 101},
	{"morocc", 160, 255},
	{"alberta", 31, 229},
	{"aldebaran", 143, 116},
	{"izlude", 128, 145},
	{"yuno", 152, 184},
	{"lighthalzen", 164, 97},
	{"einbroch", 62, 203},
	{"einbech", 181, 129},
	{"rachel", 109, 135},
	{"veins", 208, 125},
	{"hugel", 88, 165},
};

// Reviewed public entrances. Adjust only within the anchor's walkable region.
struct HappyroEntranceArrival { const char* map; std::int16_t x; std::int16_t y; };
static constexpr HappyroEntranceArrival happyro_entrance_arrivals[] = {
	{"alde_dun01", 297, 25}, // c_tower1; npc/warps/dungeons/c_tower.txt:19
	{"alde_dun02", 43, 24}, // alde_dun01; npc/warps/dungeons/alde_dun.txt:22
	{"alde_dun03", 18, 267}, // alde_dun02; npc/warps/dungeons/alde_dun.txt:26
	{"ama_fild01", 74, 34}, // amatsu; npc/warps/fields/amatsu_fild.txt:16
	{"beach_dun", 266, 67}, // comodo; npc/warps/dungeons/beach_dun.txt:16
	{"beach_dun2", 154, 25}, // comodo; npc/warps/dungeons/beach_dun.txt:18
	{"beach_dun3", 23, 260}, // comodo; npc/warps/dungeons/beach_dun.txt:20
	{"bra_fild01", 76, 32}, // brasilis; npc/warps/fields/bra_fild.txt:8
	{"c_tower1", 197, 161}, // aldebaran; npc/warps/dungeons/c_tower.txt:16
	{"cmd_fild01", 30, 317}, // beach_dun3; npc/warps/dungeons/beach_dun.txt:22
	{"cmd_fild03", 27, 68}, // cmd_fild01; npc/re/warps/fields/com_fild.txt:18
	{"cmd_fild04", 181, 367}, // cmd_fild03; npc/re/warps/fields/com_fild.txt:25
	{"ein_dun01", 21, 15}, // einbech; npc/warps/dungeons/ein_dun.txt:17
	{"ein_dun02", 291, 292}, // ein_dun01; npc/warps/dungeons/ein_dun.txt:19
	{"ein_fild07", 187, 42}, // ein_fild10; npc/warps/fields/ein_fild.txt:32
	{"ein_fild08", 163, 376}, // einbroch; npc/warps/cities/einbroch.txt:101
	{"ein_fild09", 75, 349}, // einbech; npc/warps/fields/ein_fild.txt:39
	{"ein_fild10", 28, 329}, // ein_fild09; npc/warps/fields/ein_fild.txt:34
	{"gef_fild00", 46, 199}, // geffen; npc/warps/cities/geffen.txt:19
	{"gef_fild04", 185, 44}, // geffen; npc/warps/cities/geffen.txt:17
	{"gef_fild05", 359, 307}, // gef_fild04; npc/re/warps/fields/geffen_fild.txt:37
	{"gon_dun01", 152, 49}, // gonryun; npc/warps/dungeons/gon_dun.txt:16
	{"hu_fild06", 200, 367}, // hugel; npc/warps/cities/hugel.txt:27
	{"lhz_fild02", 162, 41}, // lhz_fild03; npc/warps/fields/ein_fild.txt:51
	{"lhz_fild03", 359, 281}, // ein_fild08; npc/warps/fields/ein_fild.txt:53
	{"lou_dun01", 217, 194}, // louyang; npc/warps/dungeons/lou_dun.txt:16
	{"lou_dun02", 284, 17}, // lou_dun01; npc/warps/dungeons/lou_dun.txt:18
	{"lou_dun03", 164, 39}, // lou_dun02; npc/warps/dungeons/lou_dun.txt:20
	{"mjolnir_01", 282, 23}, // gef_fild04; npc/re/warps/fields/geffen_fild.txt:35
	{"mjolnir_03", 211, 22}, // mjolnir_07; npc/warps/fields/mtmjolnir.txt:41
	{"mjolnir_04", 126, 207}, // mjolnir_03; npc/warps/fields/mtmjolnir.txt:26
	{"mjolnir_06", 264, 34}, // gef_fild00; npc/re/warps/fields/geffen_fild.txt:17
	{"mjolnir_07", 21, 381}, // mjolnir_06; npc/warps/fields/mtmjolnir.txt:36
	{"mjolnir_08", 29, 353}, // mjolnir_07; npc/warps/fields/mtmjolnir.txt:43
	{"mjolnir_09", 45, 251}, // prt_fild00; npc/re/warps/fields/prontera_fild.txt:25
	{"prt_fild00", 24, 125}, // gef_fild00; npc/re/warps/fields/geffen_fild.txt:18
	{"prt_fild02", 305, 22}, // prt_fild06; npc/re/warps/fields/prontera_fild.txt:57
	{"prt_fild06", 28, 192}, // prontera; npc/warps/cities/prontera.txt:32
	{"ra_fild08", 165, 36}, // ra_fild12; npc/re/warps/fields/rachel_fild.txt:37
	{"ra_fild10", 373, 277}, // ra_fild11; npc/re/warps/fields/rachel_fild.txt:41
	{"ra_fild11", 348, 221}, // rachel; npc/re/warps/cities/rachel.txt:109
	{"ra_fild12", 40, 226}, // rachel; npc/re/warps/cities/rachel.txt:110
	{"ra_temple", 126, 24}, // rachel; npc/re/warps/cities/rachel.txt:23
	{"um_fild01", 35, 276}, // beach_dun2; npc/warps/fields/umbala_fild.txt:19
	{"um_fild03", 113, 54}, // cmd_fild01; npc/warps/fields/umbala_fild.txt:16
	{"um_fild04", 214, 335}, // umbala; npc/warps/fields/umbala_fild.txt:31
	{"ve_fild01", 345, 92}, // ve_fild02; npc/re/warps/fields/veins_fild.txt:25
	{"ve_fild02", 195, 377}, // rachel; npc/re/warps/cities/rachel.txt:111
	{"ve_fild06", 148, 225}, // veins; npc/warps/cities/veins.txt:48
	{"xmas_dun01", 204, 17}, // xmas; npc/warps/dungeons/xmas_dun.txt:16
	{"xmas_dun02", 133, 128}, // xmas_dun01; npc/warps/dungeons/xmas_dun.txt:18
	{"yuno_fild04", 231, 284}, // yuno; npc/warps/cities/yuno.txt:27
	{"yuno_fild11", 32, 264}, // ein_fild07; npc/warps/fields/ein_fild.txt:26
	{"yuno_fild12", 22, 229}, // yuno_fild11; npc/re/warps/fields/yuno_fild.txt:38
	// Expanded public-map batch; manifest: docs/navigation-arrivals-expanded-pass.json
	{"anthell01", 35, 262}, // cmd_fild08; npc/warps/dungeons/anthell.txt:30
	{"anthell02", 163, 165}, // cmd_fild08; npc/warps/dungeons/anthell.txt:32
	{"c_tower2", 28, 26}, // alde_dun03; npc/warps/dungeons/alde_dun.txt:39
	{"cmd_fild02", 222, 372}, // cmd_fild01; npc/re/warps/fields/com_fild.txt:17
	{"cmd_fild06", 26, 288}, // cmd_fild04; npc/re/warps/fields/com_fild.txt:29
	{"cmd_fild08", 25, 102}, // cmd_fild06; npc/re/warps/fields/com_fild.txt:36
	{"cmd_fild09", 18, 170}, // cmd_fild07; npc/re/warps/fields/com_fild.txt:40
	{"ein_fild01", 106, 40}, // ein_fild05; npc/re/warps/fields/hugel_fild.txt:53
	{"ein_fild03", 140, 36}, // lhz_fild02; npc/warps/fields/ein_fild.txt:49
	{"ein_fild04", 184, 31}, // einbroch; npc/warps/cities/einbroch.txt:99
	{"ein_fild05", 80, 294}, // ein_fild04; npc/re/warps/fields/hugel_fild.txt:19
	{"ein_fild06", 133, 39}, // ein_fild07; npc/warps/fields/ein_fild.txt:30
	{"gef_fild01", 67, 22}, // gef_fild03; npc/re/warps/fields/geffen_fild.txt:30
	{"gef_fild02", 19, 76}, // gef_fild03; npc/re/warps/fields/geffen_fild.txt:31
	{"gef_fild03", 23, 50}, // gef_fild10; npc/re/warps/fields/geffen_fild.txt:55
	{"gef_fild06", 377, 209}, // gef_fild05; npc/re/warps/fields/geffen_fild.txt:39
	{"gef_fild07", 62, 358}, // gef_fild05; npc/re/warps/fields/geffen_fild.txt:40
	{"gef_fild08", 198, 350}, // gef_fild06; npc/re/warps/fields/geffen_fild.txt:42
	{"gef_fild09", 223, 30}, // gef_fild10; npc/re/warps/fields/geffen_fild.txt:53
	{"gef_fild11", 112, 358}, // gef_fild10; npc/re/warps/fields/geffen_fild.txt:54
	{"gef_fild13", 41, 369}, // gef_fild07; npc/re/warps/fields/geffen_fild.txt:46
	{"hu_fild01", 135, 42}, // yuno_fild06; npc/re/warps/fields/yuno_fild.txt:79
	{"hu_fild02", 40, 27}, // hu_fild04; npc/re/warps/fields/hugel_fild.txt:35
	{"hu_fild04", 373, 181}, // hu_fild05; npc/re/warps/fields/yuno_fild.txt:82
	{"hu_fild05", 347, 130}, // hu_fild06; npc/re/warps/fields/hugel_fild.txt:42
	{"in_sphinx1", 287, 10}, // moc_fild19; npc/re/warps/fields/morroc_fild.txt:116
	{"in_sphinx2", 148, 82}, // in_sphinx1; npc/warps/dungeons/in_sphinx.txt:17
	{"iz_dun00", 167, 167}, // izlu2dun; npc/warps/dungeons/iz_dun.txt:17
	{"iz_dun01", 41, 37}, // iz_dun00; npc/warps/dungeons/iz_dun.txt:22
	{"iz_dun02", 236, 204}, // iz_dun01; npc/warps/dungeons/iz_dun.txt:23
	{"iz_dun03", 34, 61}, // iz_dun02; npc/warps/dungeons/iz_dun.txt:27
	{"iz_dun04", 24, 29}, // iz_dun03; npc/warps/dungeons/iz_dun.txt:28
	{"lhz_fild01", 361, 222}, // lhz_fild02; npc/warps/fields/lhalzen_fild.txt:21
	{"mjo_dun01", 50, 19}, // mjolnir_02; npc/warps/fields/mtmjolnir.txt:23
	{"mjo_dun02", 379, 341}, // mjo_dun01; npc/warps/dungeons/mjo_dun.txt:16
	{"mjo_dun03", 300, 260}, // mjo_dun02; npc/warps/dungeons/mjo_dun.txt:18
	{"mjolnir_05", 21, 170}, // mjolnir_04; npc/warps/fields/mtmjolnir.txt:29
	{"mjolnir_11", 183, 28}, // prt_fild02; npc/re/warps/fields/prontera_fild.txt:37
	{"mjolnir_12", 194, 378}, // aldebaran; npc/warps/cities/aldebaran.txt:20
	{"moc_fild01", 55, 379}, // prt_fild08; npc/re/warps/fields/prontera_fild.txt:71
	{"moc_fild02", 75, 336}, // moc_fild01; npc/re/warps/fields/morroc_fild.txt:26
	{"moc_fild03", 298, 169}, // pay_fild01; npc/re/warps/fields/payon_fild.txt:18
	{"moc_fild07", 197, 26}, // morocc; npc/warps/cities/morroc.txt:19
	{"moc_fild11", 31, 159}, // moc_fild12; npc/re/warps/fields/morroc_fild.txt:90
	{"moc_fild12", 157, 376}, // morocc; npc/warps/cities/morroc.txt:17
	{"moc_fild13", 303, 47}, // moc_fild03; npc/re/warps/fields/morroc_fild.txt:38
	{"moc_fild16", 21, 177}, // moc_fild17; npc/re/warps/fields/morroc_fild.txt:111
	{"moc_fild17", 216, 364}, // moc_fild11; npc/re/warps/fields/morroc_fild.txt:84
	{"moc_fild18", 55, 170}, // cmd_fild09; npc/re/warps/fields/com_fild.txt:48
	{"moc_fild19", 69, 165}, // moc_ruins; npc/warps/cities/morroc.txt:76
	{"moc_pryd01", 190, 7}, // moc_ruins; npc/warps/cities/morroc.txt:75
	{"moc_pryd02", 8, 190}, // moc_pryd01; npc/warps/dungeons/moc_pryd.txt:16
	{"moc_pryd03", 100, 92}, // moc_pryd02; npc/warps/dungeons/moc_pryd.txt:20
	{"moc_pryd04", 10, 20}, // moc_pryd03; npc/warps/dungeons/moc_pryd.txt:22
	{"pay_dun00", 19, 181}, // pay_arche; npc/warps/cities/payon.txt:85
	{"pay_dun01", 20, 32}, // pay_dun00; npc/warps/dungeons/pay_dun.txt:16
	{"pay_dun02", 21, 61}, // pay_dun01; npc/warps/dungeons/pay_dun.txt:19
	{"pay_dun03", 153, 157}, // pay_dun02; npc/warps/dungeons/pay_dun.txt:20
	{"pay_fild01", 331, 354}, // payon; npc/warps/cities/payon.txt:26
	{"pay_fild02", 82, 381}, // pay_fild01; npc/re/warps/fields/payon_fild.txt:19
	{"pay_fild03", 387, 62}, // alberta; npc/warps/cities/alberta.txt:17
	{"pay_fild04", 22, 163}, // moc_fild01; npc/re/warps/fields/morroc_fild.txt:29
	{"pay_fild06", 303, 370}, // pay_fild03; npc/re/warps/fields/payon_fild.txt:29
	{"pay_fild07", 23, 207}, // pay_fild01; npc/re/warps/fields/payon_fild.txt:21
	{"pay_fild08", 21, 73}, // payon; npc/warps/cities/payon.txt:28
	{"pay_fild09", 21, 89}, // pay_fild08; npc/re/warps/fields/payon_fild.txt:43
	{"pay_fild10", 21, 288}, // pay_fild07; npc/re/warps/fields/payon_fild.txt:40
	{"prt_fild01", 25, 290}, // mjolnir_09; npc/warps/fields/mtmjolnir.txt:53
	{"prt_fild03", 23, 249}, // prt_fild02; npc/re/warps/fields/prontera_fild.txt:39
	{"prt_fild07", 129, 374}, // prt_fild05; npc/re/warps/fields/prontera_fild.txt:50
	{"prt_fild08", 168, 373}, // prontera; npc/warps/cities/prontera.txt:24
	{"prt_fild09", 85, 375}, // prt_fild07; npc/re/warps/fields/prontera_fild.txt:66
	{"prt_fild10", 228, 294}, // gef_fild02; npc/re/warps/fields/geffen_fild.txt:26
	{"prt_fild11", 300, 296}, // gef_fild03; npc/re/warps/fields/geffen_fild.txt:29
	{"ra_fild01", 306, 43}, // ra_fild04; npc/re/warps/fields/rachel_fild.txt:20
	{"ra_fild03", 370, 172}, // ra_fild04; npc/re/warps/fields/rachel_fild.txt:29
	{"ra_fild04", 263, 60}, // ra_fild08; npc/re/warps/fields/rachel_fild.txt:26
	{"ra_fild05", 39, 353}, // ra_fild04; npc/re/warps/fields/rachel_fild.txt:21
	{"ra_fild06", 298, 25}, // lhz_fild01; npc/re/warps/fields/rachel_fild.txt:34
	{"um_fild02", 26, 271}, // um_fild01; npc/warps/fields/umbala_fild.txt:20
	{"ve_fild03", 345, 215}, // ve_fild04; npc/re/warps/fields/veins_fild.txt:29
	{"ve_fild04", 174, 334}, // ve_fild01; npc/re/warps/fields/veins_fild.txt:17
	{"ve_fild07", 147, 366}, // veins; npc/warps/cities/veins.txt:47
	{"yuno_fild01", 206, 21}, // aldebaran; npc/re/warps/fields/yuno_fild.txt:66
	{"yuno_fild02", 22, 335}, // yuno_fild03; npc/re/warps/fields/yuno_fild.txt:24
	{"yuno_fild03", 23, 77}, // yuno_fild04; npc/re/warps/fields/yuno_fild.txt:26
	{"yuno_fild06", 218, 33}, // yuno_fild03; npc/re/warps/fields/yuno_fild.txt:74
	{"yuno_fild07", 90, 16}, // yuno_fild11; npc/re/warps/fields/yuno_fild.txt:40
	{"yuno_fild08", 141, 21}, // yuno_fild12; npc/re/warps/fields/yuno_fild.txt:41
	{"yuno_fild09", 68, 21}, // yuno_fild01; npc/re/warps/fields/yuno_fild.txt:43
	// Common dungeon batch; manifest: docs/navigation-arrivals-dungeon-pass.json
	{"ayo_fild01", 37, 241}, // ayothaya; npc/warps/cities/ayothaya.txt:52
	{"c_tower3", 65, 147}, // c_tower2; npc/warps/dungeons/c_tower.txt:20
	{"dew_dun02", 301, 29}, // dew_fild01; npc/re/warps/cities/dewata.txt:21
	{"dew_fild01", 371, 210}, // dewata; npc/re/warps/cities/dewata.txt:17
	{"gef_dun00", 102, 97}, // gef_tower; npc/warps/dungeons/gef_dun.txt:34
	{"gef_dun01", 114, 235}, // gef_dun00; npc/warps/dungeons/gef_dun.txt:41
	{"gef_dun02", 104, 130}, // gef_dun01; npc/warps/dungeons/gef_dun.txt:43
	{"gef_tower", 52, 177}, // geffen; npc/warps/cities/geffen.txt:18
	{"gl_cas01", 199, 29}, // glast_01; npc/warps/fields/glastheim.txt:84
	{"gl_cas02", 104, 189}, // glast_01; npc/warps/fields/glastheim.txt:82
	{"gl_church", 155, 8}, // glast_01; npc/warps/fields/glastheim.txt:83
	{"gl_chyard", 146, 16}, // gl_church; npc/warps/fields/glastheim.txt:34
	{"gl_dun01", 133, 271}, // gl_sew04; npc/warps/fields/glastheim.txt:76
	{"gl_dun02", 223, 273}, // gl_dun01; npc/warps/fields/glastheim.txt:39
	{"gl_knt01", 150, 15}, // glast_01; npc/warps/fields/glastheim.txt:89
	{"gl_knt02", 15, 140}, // gl_knt01; npc/warps/fields/glastheim.txt:46
	{"gl_prison", 149, 178}, // gl_prison1; npc/warps/fields/glastheim.txt:64
	{"gl_prison1", 61, 183}, // gl_sew01; npc/warps/fields/glastheim.txt:67
	{"gl_sew01", 18, 25}, // gl_sew02; npc/warps/fields/glastheim.txt:68
	{"gl_sew02", 296, 22}, // gl_knt01; npc/warps/fields/glastheim.txt:50
	{"gl_sew03", 170, 282}, // gl_sew02; npc/warps/fields/glastheim.txt:72
	{"gl_sew04", 67, 276}, // gl_sew03; npc/warps/fields/glastheim.txt:75
	{"gl_step", 12, 7}, // glast_01; npc/warps/fields/glastheim.txt:88
	{"gon_fild01", 191, 261}, // gonryun; npc/warps/cities/gonryun.txt:32
	{"ice_dun01", 161, 10}, // ra_fild01; npc/re/warps/fields/rachel_fild.txt:18
	{"ice_dun02", 151, 139}, // ice_dun01; npc/warps/dungeons/ice_dun.txt:19
	{"ice_dun03", 149, 24}, // ice_dun02; npc/warps/dungeons/ice_dun.txt:21
	{"in_orcs01", 28, 159}, // gef_fild10; npc/re/warps/fields/geffen_fild.txt:60
	{"in_sphinx3", 209, 53}, // in_sphinx2; npc/warps/dungeons/in_sphinx.txt:19
	{"in_sphinx4", 8, 220}, // in_sphinx3; npc/warps/dungeons/in_sphinx.txt:25
	{"in_sphinx5", 98, 101}, // in_sphinx4; npc/warps/dungeons/in_sphinx.txt:27
	{"lou_fild01", 232, 352}, // louyang; npc/warps/cities/louyang.txt:16
	{"ma_fild01", 41, 271}, // malaya; npc/re/warps/cities/malaya.txt:21
	{"ma_fild02", 247, 37}, // ma_fild01; npc/re/warps/cities/malaya.txt:26
	{"mag_dun01", 124, 70}, // yuno_fild03; npc/re/warps/fields/yuno_fild.txt:30
	{"mag_dun02", 47, 32}, // mag_dun01; npc/warps/dungeons/mag_dun.txt:17
	{"mjolnir_10", 233, 376}, // mjolnir_05; npc/warps/fields/mtmjolnir.txt:32
	{"moc_pryd05", 92, 94}, // moc_prydb1; npc/warps/dungeons/moc_pryd.txt:35
	{"moc_pryd06", 192, 10}, // moc_pryd05; npc/warps/dungeons/moc_pryd.txt:30
	{"moc_prydb1", 100, 185}, // moc_pryd01; npc/warps/dungeons/moc_pryd.txt:18
	{"nif_fild01", 341, 320}, // nif_fild02; npc/warps/cities/niflheim.txt:20
	{"nif_fild02", 375, 234}, // niflheim; npc/warps/cities/niflheim.txt:22
	{"orcsdun01", 30, 168}, // in_orcs01; npc/warps/dungeons/orcsdun.txt:21
	{"orcsdun02", 178, 19}, // in_orcs01; npc/warps/dungeons/orcsdun.txt:23
	{"thor_v01", 21, 229}, // ve_fild03; npc/warps/dungeons/thor_v.txt:15
	{"thor_v02", 78, 203}, // thor_v01; npc/warps/dungeons/thor_v.txt:17
	{"thor_v03", 35, 262}, // thor_v02; npc/warps/dungeons/thor_v.txt:18
	{"xmas_fild01", 79, 247}, // xmas; npc/warps/cities/lutie.txt:17
	// Full review batch; manifest: docs/navigation-arrivals-full-pass.json
	{"ama_in02", 222, 44}, // amatsu; npc/warps/cities/amatsu.txt:35
	{"ayo_in02", 100, 152}, // ayothaya; npc/warps/cities/ayothaya.txt:50
	{"dew_in01", 7, 35}, // dew_fild01; npc/re/warps/cities/dewata.txt:19
	{"jupe_cave", 143, 52}, // yuno_fild07; npc/warps/dungeons/juperos.txt:24
	{"juperos_01", 52, 246}, // jupe_cave; npc/warps/dungeons/juperos.txt:26
	{"ma_scene01", 141, 76}, // ma_fild01; npc/re/warps/cities/malaya.txt:28
	{"mal_dun01", 34, 229}, // malangdo; npc/re/warps/cities/malangdo.txt:43
	{"mal_in02", 56, 60}, // malangdo; npc/re/warps/cities/malangdo.txt:47
	{"prt_church", 100, 60}, // prontera; npc/warps/cities/prontera.txt:31
	{"prt_monk", 27, 247}, // prt_fild03; npc/re/warps/fields/prontera_fild.txt:41
	{"ve_in02", 17, 19}, // veins; npc/warps/cities/veins.txt:45
	{"yuno_in02", 168, 61}, // yuno; npc/warps/cities/yuno.txt:84
	{"yuno_in05", 192, 194}, // yuno_in02; npc/warps/cities/yuno.txt:88
};

#endif
