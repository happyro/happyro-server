int main() {
 auto attempt=[](int basic,int doram,int blocked,time_t last,int type,bool check=true) {
  map_session_data sd;sd.basic=basic;sd.doram=doram;sd.state.block_action=blocked;sd.emotionlasttime=last;
  request.emotion_type=type;battle_config.basic_skill_check=check;reason=-1;sent=0;
  clif_parse_Emotion(0,&sd);
 };
 attempt(0,0,0,0,ET_NORMAL);assert(reason==0&&sent==0);
 attempt(1,0,0,0,ET_NORMAL);assert(reason==0&&sent==0);
 attempt(2,0,0,0,ET_NORMAL);assert(reason==-1&&sent==1);
 attempt(0,1,0,0,ET_NORMAL);assert(reason==-1&&sent==1);
 attempt(0,0,0,0,ET_NORMAL,false);assert(reason==-1&&sent==1);
 attempt(2,0,0,time(nullptr)+60,ET_NORMAL);assert(reason==4&&sent==0);
 attempt(2,0,PCBLOCK_EMOTION,0,ET_NORMAL);assert(reason==23&&sent==0);
 attempt(2,0,0,0,ET_CHAT_PROHIBIT);assert(reason==11&&sent==0);
 std::cout << "PASS emotion prerequisites, cooldown, blocked state and forbidden icon\n";
}
