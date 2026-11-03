import { system, world } from "@minecraft/server";

// Deepcore's crates show a ? for our item until we say which picture it is (rc:dq_icons).
// It keeps them in memory, so this goes again on every load. Nothing happens if Deepcore isn't installed.
system.runTimeout(() => {
  world.getDimension("overworld").runCommand(`scriptevent dq:add_icon ${JSON.stringify({ entity: "rc:dq_icons", icons: { "rc:roasted_carrot": 1 } })}`);
}, 20);
