#include <cassert>
#include <cstdint>
#include <ctime>
#include <iostream>
using int32=int32_t;
constexpr int NV_BASIC=1, SU_BASIC_SKILL=5018, PCBLOCK_EMOTION=1;
constexpr int IDLE_EMOTION=1, USESKILL_FAIL_LEVEL=0, USESKILL_FAIL_SKILLINTERVAL=4, USESKILL_FAIL_TOTARGET=11, USESKILL_FAIL_CONDITION=23;
enum emotion_type { ET_NORMAL, ET_CHAT_PROHIBIT, ET_DICE1, ET_DICE6=7, ET_MAX=100 };
struct PACKET_CZ_REQ_EMOTION { int emotion_type=ET_NORMAL; } request;
void* RFIFOP(int,int) { return &request; }
struct companion { int idletime; };
struct map_session_data { int basic=0,doram=0; time_t emotionlasttime=0; int idletime=0,idletime_hom=0,idletime_mer=0; companion *hd=nullptr,*md=nullptr; struct { int block_action=0; } state; };
struct { int basic_skill_check=1,idletime_option=0,hom_idle_no_share=0,idletime_hom_option=0,mer_idle_no_share=0,idletime_mer_option=0,client_reshuffle_dice=0; } battle_config;
int last_tick=0, reason=-1, sent=0;
int pc_checkskill(map_session_data* s,int id) { return id==NV_BASIC?s->basic:s->doram; }
void clif_skill_fail(map_session_data&,int skill,int cause,int subtype) { assert(skill==1&&subtype==1);reason=cause; }
void clif_emotion(map_session_data&,emotion_type) { ++sent; }
int rnd() { return 0; }
