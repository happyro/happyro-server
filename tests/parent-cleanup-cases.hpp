void notify(map_session_data* sd, ...) {
 va_list args;va_start(args,sd);chrif_parent_removed(sd,args);va_end(args);
}
int main(){
 mmo_charstatus child{10,20};
 parents={"20"};
 assert(char_validate_parent_links(&child));
 assert(child.father==0 && child.mother==20);
 child={10,20};parents={"10","20"};
 assert(char_validate_parent_links(&child));
 assert(child.father==10 && child.mother==20);
 child={10,20};parents={};
 assert(char_validate_parent_links(&child));
 assert(child.father==0 && child.mother==0);
 child={10,20};failed=true;
 assert(!char_validate_parent_links(&child));
 assert(child.father==10 && child.mother==20);
 child={};assert(char_validate_parent_links(&child));
 map_session_data online{{10,20}};
 notify(&online,uint32(10));assert(online.status.father==0 && online.status.mother==20);
 notify(&online,uint32(99));assert(online.status.mother==20);
 notify(&online,uint32(20));assert(online.status.mother==0);
}
