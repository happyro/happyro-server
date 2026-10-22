#include "../src/map/happyro_map_load_recovery.hpp"
#include <cassert>

int main() {
 HappyroMapLoadRecovery load;
 load.begin(100);
 assert(load.request(100, 0, false).status == 4); // login registry not ready
 load.restore(false, 0);
 assert(load.request(99, 0, true).status == 1); // stale generation
 assert(load.request(0, 0, true).status == 1);
 assert(load.request(100, 9, true).status == 3); // no arbitrary actions
 auto previous = load.request(100, 0, true);
 assert(previous.status == 0 && previous.destination == 0 && previous.attempt == 1);
 load.attempt = previous.attempt;
 load.begin(101);
 assert(load.request(100, 0, true).status == 1); // replay after recovery
 auto safety = load.request(101, 0, true);
 assert(safety.status == 0 && safety.destination == 1 && safety.attempt == 2);
 load.attempt = safety.attempt;
 load.begin(102);
 assert(load.request(102, 0, true).status == 2);
 assert(load.request(102, 1, true).status == 2); // manual does not bypass budget
 // Relog and cross-map-server transfer use a new token and the persisted budget.
 HappyroMapLoadRecovery relog;
 relog.begin(200);
 relog.restore(true, load.attempt);
 assert(relog.request(102, 0, true).status == 1);
 assert(relog.request(200, 0, true).status == 2);
 relog.confirm();
 assert(relog.request(200, 1, true).status == 1); // success cannot be used as a warp
 assert(relog.attempt == 0);
 // First-ever login has no successful previous map: go directly to safety.
 relog.begin(201);
 safety = relog.request(201, 0, false);
 assert(safety.status == 0 && safety.destination == 1 && safety.attempt == 2);
 // Manual safe destination skips the previous map, but consumes the same budget.
 HappyroMapLoadRecovery manual;
 manual.restore(false, 2);
 manual.begin(300);
 auto direct = manual.request(300, 1, true);
 assert(direct.status == 0 && direct.destination == 1 && direct.attempt == 2);
 // A successful scene resets the recovery budget for the next normal transition.
 manual.attempt = 2;
 manual.confirm();
 manual.begin(301);
 assert(manual.request(301, 0, true).destination == 0);
 // Interrupted recovery stage 1 survives relog and proceeds only to safety.
 manual.restore(true, 1);
 assert(manual.request(301, 0, true).destination == 1);
 manual.restore(true, 255);
 assert(manual.request(301, 0, true).status == 2);
}
