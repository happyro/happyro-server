int main(){
 auto run=[](map_session_data& sd,nlohmann::json payload){int status=0;nlohmann::json result;apply(&sd,{{"payload",payload}},status,result);return status;};
 map_session_data sd;
 assert(run(sd,{{"job_id",4}})==200); assert(sd.status.base_level==200); assert(sd.battle_status.ap==200);
 assert(run(sd,{{"base_level",99}})==200); assert(sd.status.base_level==200);
 assert(run(sd,{{"base_level",250}})==200); assert(sd.status.base_level==250);
 assert(run(sd,{{"job_id",3}})==200); assert(sd.status.base_level==250);
 assert(run(sd,{{"job_id",4}})==200); assert(sd.status.base_level==250);
 assert(run(sd,{{"base_level",9999}})==200); assert(sd.status.base_level==275);
 assert(run(sd,{{"job_id",1}})==200); assert(sd.status.base_level==99);
 assert(run(sd,{{"job_id",4},{"base_level",1}})==200); assert(sd.status.base_level==200);
 sd.status.base_level=99; assert(run(sd,{{"job_id",4}})==200); assert(sd.status.base_level==200);
 for(auto payload:{nlohmann::json{{"job_id",2}},nlohmann::json{{"base_level",0}},nlohmann::json{{"job_id",4},{"job_level",999}},nlohmann::json{{"base_level","200"}}}){
  int writes=sd.writes,saves=sd.saves; assert(run(sd,payload)==400);assert(sd.writes==writes&&sd.saves==saves);
 }
 std::cout<<"Progression normalization: 13 scenarios passed\n";
}
