int32 pc_equippoint(const map_session_data* sd, int32 i) { return pc_equippoint_sub(sd, sd->inventory_data[i]); }
bool pc_unequipitem(map_session_data* sd, int32 i, int32 flag) {
 assert(flag == 2);
 InventoryEquipUpdate update(*sd);
 sd->inventory.u.items_inventory[i].equip=0;
 ++sd->removed;
 if (sd->grant_on_remove) { sd->left_skill=1; sd->grant_on_remove=false; }
 return true;
}
void status_calc_pc(map_session_data* sd, int) { InventoryEquipUpdate update(*sd); ++sd->recalcs; if (sd->clear_on_recalc) sd->left_skill=0; }
void pc_equipswitch_remove(map_session_data* sd, int32 i) { sd->inventory.u.items_inventory[i].equipSwitch=0; ++sd->switches_removed; }
void clif_inventorylist(map_session_data* sd) { sd->inventory_dual_wield=pc_can_dual_wield(sd); ++sd->sends; }
int main() {
 item_data dagger{W_DAGGER,EQP_WEAPON}, shadow{W_DAGGER,EQP_SHADOW_WEAPON}, shield{W_OTHER,32};
 map_session_data sd;
 clif_inventorylist(&sd); sd.sends=0;
 { InventoryEquipUpdate update(sd); sd.left_skill=1; }
 assert(sd.sends==1 && sd.inventory_dual_wield==1);
 assert(pc_equippoint_sub(&sd,&dagger)==EQP_ARMS);
 assert(pc_equippoint_sub(&sd,&shadow)==EQP_SHADOW_ARMS);
 { InventoryEquipUpdate update(sd); sd.left_skill=5; }
 assert(sd.sends==1); // Higher skill level does not change permitted slots.
 { InventoryEquipUpdate outer(sd);
   sd.left_skill=0;
   { InventoryEquipUpdate inner(sd); assert(sd.sends==1); }
   sd.left_skill=5;
 }
 assert(sd.sends==1); // Temporary reset during recalculation is not published.
 sd.inventory_data[0]=&dagger; sd.inventory.u.items_inventory[0]={1,32,0};
 sd.inventory_data[1]=&shield; sd.inventory.u.items_inventory[1]={2,32,0};
 sd.inventory_data[2]=&shadow; sd.inventory.u.items_inventory[2]={3,262144,0};
 sd.inventory_data[3]=&dagger; sd.inventory.u.items_inventory[3]={4,2,0};
 sd.inventory_data[4]=&dagger; sd.inventory.u.items_inventory[4]={5,0,32};
 sd.inventory_data[5]=&shield; sd.inventory.u.items_inventory[5]={6,0,32};
 { InventoryEquipUpdate update(sd); sd.left_skill=0; }
 assert(sd.sends==2 && sd.removed==2 && sd.recalcs==1 && sd.switches_removed==1);
 assert(sd.inventory.u.items_inventory[1].equip==32 && sd.inventory.u.items_inventory[3].equip==2);
 assert(sd.inventory.u.items_inventory[5].equipSwitch==32);
 assert(pc_equippoint_sub(&sd,&dagger)==EQP_WEAPON && pc_equippoint_sub(&sd,&shadow)==EQP_SHADOW_WEAPON);
 { InventoryEquipUpdate update(sd); sd.class_=MAPID_ASSASSIN|0x100; }
 assert(sd.sends==3 && sd.inventory_dual_wield==1);
 { InventoryEquipUpdate update(sd); sd.left_skill=1; }
 { InventoryEquipUpdate update(sd); sd.left_skill=0; }
 assert(sd.sends==3); // Assassin remains eligible after a skill reset.
 { InventoryEquipUpdate update(sd); sd.class_=MAPID_KAGEROUOBORO; }
 assert(sd.sends==3);
 { InventoryEquipUpdate update(sd); sd.class_=6; }
 assert(sd.sends==4 && sd.inventory_dual_wield==0);
 map_session_data chained;
 chained.left_skill=1;
 clif_inventorylist(&chained); chained.sends=0;
 chained.grant_on_remove=true; chained.clear_on_recalc=true;
 chained.inventory_data[0]=&dagger; chained.inventory.u.items_inventory[0]={1,32,0};
 chained.inventory_data[2]=&shadow; chained.inventory.u.items_inventory[2]={3,262144,0};
 { InventoryEquipUpdate update(chained); chained.left_skill=0; }
 assert(chained.removed==2 && chained.sends==1);
 assert(chained.inventory.u.items_inventory[2].equip==0);
 map_session_data saving;
 clif_inventorylist(&saving); saving.sends=0;
 { InventoryEquipUpdate update(saving);
   saving.left_skill=1;
   update.finish();
   assert(saving.sends==1 && saving.inventory_equip_update_depth==0);
   update.finish();
 }
 assert(saving.sends==1 && saving.inventory_equip_update_depth==0);
 map_session_data temporary;
 clif_inventorylist(&temporary); temporary.sends=0;
 temporary.inventory_data[0]=&dagger;
 { InventoryEquipUpdate outer(temporary);
   { InventoryEquipUpdate grant(temporary); temporary.left_skill=1; }
   temporary.inventory.u.items_inventory[0]={1,32,0};
   { InventoryEquipUpdate revoke(temporary); temporary.left_skill=0; }
 }
 assert(temporary.removed==1 && temporary.inventory.u.items_inventory[0].equip==0);
 assert(temporary.sends==1);
 map_session_data unchanged;
 clif_inventorylist(&unchanged); unchanged.sends=0;
 { InventoryEquipUpdate outer(unchanged);
   { InventoryEquipUpdate grant(unchanged); unchanged.left_skill=1; }
   { InventoryEquipUpdate revoke(unchanged); unchanged.left_skill=0; }
 }
 assert(unchanged.sends==0 && unchanged.removed==0);
 map_session_data loading;
 { InventoryEquipUpdate update(loading); loading.left_skill=1; }
 assert(loading.sends==0); // Initial inventory has not yet been sent.
 loading.inventory_dual_wield=0; loading.prev=false;
 { InventoryEquipUpdate update(loading); }
 assert(loading.sends==0);
 puts("PASS: grants, removals, nested recalculation, ordinary/shadow slots, legal equipment, switches, job eligibility and login boundaries");
}
