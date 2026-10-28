int main(){
 item_data data;map_session_data sd;sd.inventory_data[0]=&data;
 auto available=[&]{return pc_equipment_candidate(&sd,0,data.equip);};
 assert(available());
 // Profession family and branch are independent of upper/baby/third/fourth restrictions.
 data.class_base[0]=1ULL<<1;assert(!available());sd.class_=1;assert(available());
 sd.class_=1|JOBL_2_1;data.class_base[1]=0;assert(!available());data.class_base[1]=1ULL<<1;assert(available());
 for(int upper: {JOBL_UPPER,JOBL_BABY,JOBL_THIRD,JOBL_FOURTH}){
  sd.class_=1|upper;data.class_upper=ITEMJ_NORMAL;assert(!available());
  data.class_upper=upper==JOBL_UPPER?ITEMJ_UPPER:upper==JOBL_BABY?ITEMJ_BABY:upper==JOBL_THIRD?ITEMJ_THIRD:ITEMJ_FOURTH;assert(available());
 }
 sd.class_=1|JOBL_THIRD|JOBL_UPPER;data.class_upper=ITEMJ_THIRD;assert(!available());data.class_upper=ITEMJ_THIRD_UPPER;assert(available());
 sd.class_=1|JOBL_THIRD|JOBL_BABY;data.class_upper=ITEMJ_THIRD_BABY;assert(available());
 sd.class_=1;data.class_upper=ITEMJ_NORMAL;
 data.elv=51;assert(!available());data.elv=50;assert(available());data.elvmax=49;assert(!available());data.elvmax=50;assert(available());
 data.sex=1;assert(!available());sd.status.sex=1;assert(available());
 data.elv=200;sd.gm=true;assert(available());sd.gm=false;
 data.equip=EQP_HEAD_TOP;sd.status.base_level=90;sd.sc.values[SC_SPIRIT]={SL_SUPERNOVICE};assert(available());sd.sc.values.clear();assert(!available());
 data=item_data{};sd.status.base_level=50;
 sd.inventory.u.items_inventory[0].identify=0;assert(!available());sd.inventory.u.items_inventory[0].identify=1;
 sd.inventory.u.items_inventory[0].attribute=1;assert(!available());sd.inventory.u.items_inventory[0].attribute=0;
 sd.inventory.u.items_inventory[0].equip=EQP_ARMOR;assert(!available());sd.inventory.u.items_inventory[0].equip=0;
 noEquip=true;assert(!available());noEquip=false;
 sd.sc.values[SC_STRIPARMOR]={};assert(!available());sd.sc.values.clear();
 sd.sc.cant.equip=true;assert(!available());sd.sc.cant.equip=false;
 data.type=IT_WEAPON;data.equip=EQP_HAND_R;sd.sc.values[SC_PYROCLASTIC]={};assert(!available());sd.sc.values.clear();
 data.type=IT_AMMO;data.equip=EQP_AMMO;data.subtype=AMMO_ARROW;sd.status.weapon=W_DAGGER;
 assert(!available());assert(messages==0);assert(pc_isequip(&sd,0)==ITEM_EQUIP_ACK_FAIL);assert(messages==1);
 sd.status.weapon=W_BOW;assert(available());
 data=item_data{};data.equip=EQP_ACC;data.slots=1;sd.inventory.u.items_inventory[0].card[0]=100;
 auto card=std::make_shared<item_data>();card->equip=EQP_ACC_L;item_db.items[100]=card;
 assert(pc_equipment_candidate(&sd,0,EQP_ACC_L));assert(!pc_equipment_candidate(&sd,0,EQP_ACC_R));
 assert(!pc_equipment_candidate(&sd,-1,16));assert(!pc_equipment_candidate(&sd,MAX_INVENTORY,16));assert(!pc_equipment_candidate(&sd,0,0));assert(!pc_equipment_candidate(&sd,0,3));
 assert(!pc_equipment_action_blocked(&sd));sd.dead=true;assert(pc_equipment_action_blocked(&sd));sd.dead=false;
 sd.canequip_tick=101;assert(pc_equipment_action_blocked(&sd));sd.canequip_tick=100;assert(!pc_equipment_action_blocked(&sd));
 sd.npc_id=1;assert(pc_equipment_action_blocked(&sd));sd.npc_item_flag=true;assert(!pc_equipment_action_blocked(&sd));
 sd.state.block_action=PCBLOCK_EQUIP;assert(pc_equipment_action_blocked(&sd));
 puts("PASS: profession, class tiers, level, sex, exemptions, status, identity and silent checks");
}
