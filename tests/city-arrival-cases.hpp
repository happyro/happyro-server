int main(){
 int16 x=20,y=20;
 assert(happyro_find_safe_arrival(0,x,y) && x==20 && y==20);
 // A rectangular warp: reject its entire area and the two-cell margin.
 for(int cy=19;cy<=21;++cy) for(int cx=17;cx<=23;++cx) touch[cy][cx]=true;
 assert(!happyro_safe_arrival_cell(0,25,21));
 assert(happyro_safe_arrival_cell(0,26,21));
 assert(happyro_find_safe_arrival(0,x,y));
 assert(std::abs(x-20)>5 || std::abs(y-20)>3);
 assert(happyro_safe_arrival_cell(0,x,y));
 occupied[10][10]=true; x=10;y=10;
 assert(happyro_find_safe_arrival(0,x,y) && !(x==10 && y==10));
 assert(!happyro_safe_arrival_cell(0,-1,10));
 assert(!happyro_safe_arrival_cell(0,40,10));
 assert(!happyro_safe_arrival_cell(1,10,10));
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 x=20;y=20;
 assert(!happyro_find_safe_arrival(0,x,y));
 assert(x==20 && y==20); // Failure must not become a random teleport.

 clear_cells();
 map_session_data sd;
 // Every reviewed service entry resolves its live NPC position.
 for (const auto& entry:happyro_service_arrivals){
  npcs.clear();npcs[entry.npc]={};
  auto& npc=npcs[entry.npc];
  occupied[npc.y][npc.x]=true;
  assert(happyro_default_arrival(&sd,0,entry.map,x,y));
  assert(std::max(std::abs(x-npc.x),std::abs(y-npc.y))>=2);
  assert(std::max(std::abs(x-npc.x),std::abs(y-npc.y))<=6);
  occupied[npc.y][npc.x]=false;
 }
 // Teleports can use the outer ring, but never fall back inside two cells.
 clear_cells();
 npc_data nearby;nearby.x=20;nearby.y=20;
 for(int cy=15;cy<=25;++cy) for(int cx=15;cx<=25;++cx) blocked[cy][cx]=true;
 assert(happyro_npc_arrival_cell(nearby,x,y,2,6));
 assert(std::max(std::abs(x-20),std::abs(y-20))==6);
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 blocked[20][21]=false;
 assert(!happyro_npc_arrival_cell(nearby,x,y,2,6));
 assert(happyro_npc_adjacent_cell(nearby,x,y) && x==21 && y==20);
 // Runtime movement and unavailable NPCs: never use stale coordinates.
 clear_cells();
 auto& npc=npcs["kaf_comodo"];npc.x=30;npc.y=30;occupied[30][30]=true;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x>=27 && y>=27);
 npc.is_invisible=true;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 npc.is_invisible=false;npc.cloaked=true;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 npc.cloaked=false;npc.hidden=true;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 npc.hidden=false;npc.sc.option=OPTION_HIDE;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 npc.sc.option=0;npc.m=1;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 // Secondary service NPC on the same map can be used when the first is absent.
 npcs.clear();npcs["kaf_malaya2"].x=30;npcs["kaf_malaya2"].y=30;
 assert(happyro_default_arrival(&sd,0,"malaya",x,y) && x>=27 && y>=27);
 // No service/blocked service area: search safely near the map center.
 clear_cells();npcs["kaf_comodo"]={};
 for(int cy=6;cy<=14;++cy) for(int cx=6;cx<=14;++cx) touch[cy][cx]=true;
 assert(happyro_default_arrival(&sd,0,"comodo",x,y) && x==20 && y==20);
 clear_cells();blocked[20][20]=true;
 assert(happyro_default_arrival(&sd,0,"unknown",x,y) && !(x==20 && y==20));
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 blocked[2][2]=false;
 assert(happyro_default_arrival(&sd,0,"unknown",x,y) && x==2 && y==2);
 blocked[2][2]=true;
 assert(!happyro_default_arrival(&sd,0,"unknown",x,y));
 clear_cells();data.xs=data.ys=400;
 for(const auto& entry:happyro_city_arrivals){
  assert(happyro_default_arrival(&sd,0,entry.map,x,y) && x==entry.x && y==entry.y);
 }

 // All reviewed entrances resolve, and occupancy can adjust within the same region.
 for(const auto& entry:happyro_entrance_arrivals){
  assert(happyro_default_arrival(&sd,0,entry.map,x,y) && x==entry.x && y==entry.y);
  occupied[entry.y][entry.x]=true;
  assert(happyro_default_arrival(&sd,0,entry.map,x,y));
  assert(x!=entry.x || y!=entry.y);
  occupied[entry.y][entry.x]=false;
 }
 // No landing across an impassable wall even if it is closer in coordinate space.
 clear_cells();data.xs=data.ys=40;
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 blocked[20][20]=false;blocked[20][21]=false;occupied[20][20]=occupied[20][21]=true;
 blocked[20][23]=false;x=20;y=20;
 assert(!happyro_find_safe_arrival(0,x,y,12,true));
 assert(happyro_find_safe_arrival(0,x,y,12,false) && x==23 && y==20);
 // New entrance maps reject unavailable anchors; they do not fall back to center.
 clear_cells();data.xs=data.ys=400;
 const auto& entrance=happyro_entrance_arrivals[0];
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 blocked[200][200]=false;
 assert(!happyro_default_arrival(&sd,0,entrance.map,x,y));
 // Random arrival varies and retains the safe-cell checks instead of using an anchor.
 clear_cells();data.xs=data.ys=40;
 touch[20][20]=true;occupied[10][10]=true;blocked[5][5]=true;
 std::set<std::pair<int,int>> arrivals;
 for(int i=0;i<100;++i){
  assert(happyro_random_arrival(0,x,y));
  assert(happyro_safe_arrival_cell(0,x,y));
  arrivals.insert({x,y});
 }
 assert(arrivals.size()>50);
 for(auto& row:blocked) for(bool& cell:row) cell=true;
 assert(!happyro_random_arrival(0,x,y));
 assert(!happyro_random_arrival(-1,x,y));
 std::cout << "safe arrival regression cases passed\n";
}
