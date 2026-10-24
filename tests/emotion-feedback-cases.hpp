int main() {
 auto attempt=[](int basic,int doram,int blocked,t_tick next,int type,bool check=true) {
  map_session_data sd;sd.basic=basic;sd.doram=doram;sd.state.block_action=blocked;sd.next_emotion_tick=next;
  request.emotion_type=type;battle_config.basic_skill_check=check;reason=-1;sent=0;
  clif_parse_Emotion(0,&sd);
 };
 attempt(0,0,0,0,ET_NORMAL);assert(reason==0&&sent==0);
 attempt(1,0,0,0,ET_NORMAL);assert(reason==0&&sent==0);
 attempt(2,0,0,0,ET_NORMAL);assert(reason==-1&&sent==1);
 attempt(0,1,0,0,ET_NORMAL);assert(reason==-1&&sent==1);
 attempt(0,0,0,0,ET_NORMAL,false);assert(reason==-1&&sent==1);
 attempt(2,0,0,clock_tick+60,ET_NORMAL);assert(reason==4&&sent==0);
 attempt(2,0,PCBLOCK_EMOTION,0,ET_NORMAL);assert(reason==23&&sent==0);
 attempt(2,0,0,0,ET_CHAT_PROHIBIT);assert(reason==11&&sent==0);
 // Failed repeated taps must not extend the 500 ms cooldown.
 map_session_data sd;sd.basic=2;request.emotion_type=ET_NORMAL;sent=0;reason=-1;
 clif_parse_Emotion(0,&sd);assert(sent==1&&sd.next_emotion_tick==1500);
 clock_tick=1499;clif_parse_Emotion(0,&sd);
 assert(sent==1&&reason==USESKILL_FAIL_SKILLINTERVAL&&sd.next_emotion_tick==1500);
 clock_tick=1500;reason=-1;clif_parse_Emotion(0,&sd);
 assert(sent==2&&reason==-1&&sd.next_emotion_tick==2000);
 clock_tick=2000;sd.state.block_action=PCBLOCK_EMOTION;clif_parse_Emotion(0,&sd);
 assert(sent==2&&reason==USESKILL_FAIL_CONDITION&&sd.next_emotion_tick==2000);
 sd.state.block_action=0;reason=-1;clif_parse_Emotion(0,&sd);
 assert(sent==3&&reason==-1&&sd.next_emotion_tick==2500);
 std::cout << "PASS emotion prerequisites, cooldown, blocked state and forbidden icon\n";
}
