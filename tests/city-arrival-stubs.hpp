#include <algorithm>
#include <cassert>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <cstring>
#include <string>
#include <unordered_map>
#include <queue>
#include <random>
#include <set>
using int16 = int16_t;
constexpr int BL_CHAR=1, BL_NPC=2, CELL_CHKNPC=3, CELL_CHKNOPASS=4;
struct map_data { int16 xs=40, ys=40; } data;
bool blocked[400][400]{}, touch[400][400]{}, occupied[400][400]{};
map_data* map_getmapdata(int16 m){ return m==0 ? &data : nullptr; }
bool map_cell_free(int16, int16 x, int16 y, int){
 assert(x>=0 && x<data.xs && y>=0 && y<data.ys);
 return !blocked[y][x] && !occupied[y][x];
}
bool map_getcell(int16, int16 x, int16 y, int type){
 assert(x>=0 && x<data.xs && y>=0 && y<data.ys);
 return type==CELL_CHKNOPASS ? blocked[y][x] : touch[y][x];
}

constexpr int OPTION_HIDE=1;
struct map_session_data {};
struct npc_data {
 int16 m=0,x=10,y=10;
 bool is_invisible=false,cloaked=false,hidden=false;
 struct { int option=0; } sc;
};
std::unordered_map<std::string,npc_data> npcs;
npc_data* npc_name2id(const char* name){
 auto found=npcs.find(name);return found==npcs.end()?nullptr:&found->second;
}
bool npc_is_cloaked(const npc_data* npc,map_session_data*){return npc->cloaked;}
bool npc_is_hidden_dynamicnpc(const npc_data& npc,map_session_data&){return npc.hidden;}
void clear_cells(){
 for(auto& row:blocked) std::fill(std::begin(row),std::end(row),false);
 for(auto& row:occupied) std::fill(std::begin(row),std::end(row),false);
 for(auto& row:touch) std::fill(std::begin(row),std::end(row),false);
 npcs.clear();
}

// Connectivity stub uses an actual flood fill, so tests can model separated rooms.
bool path_search(void*,int16,int16 x0,int16 y0,int16 x1,int16 y1,int,int){
 std::queue<std::pair<int,int>> q;std::set<std::pair<int,int>> seen;
 q.push({x0,y0});seen.insert({x0,y0});
 while(!q.empty()){
  auto [x,y]=q.front();q.pop();if(x==x1 && y==y1)return true;
  const int neighbors[][2]={{x-1,y},{x+1,y},{x,y-1},{x,y+1}};
  for(auto& p:neighbors){
   if(p[0]<0 || p[1]<0 || p[0]>=data.xs || p[1]>=data.ys || blocked[p[1]][p[0]])continue;
   if(seen.insert({p[0],p[1]}).second)q.push({p[0],p[1]});
  }
 }
 return false;
}

std::mt19937 random_engine(42);
int rnd_value(int low, int high){ return std::uniform_int_distribution<int>(low, high)(random_engine); }
