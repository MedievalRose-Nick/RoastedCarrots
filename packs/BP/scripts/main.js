import { system, world } from "@minecraft/server";

// Deepcore's crates show a ? for our item until we say which picture it is (rc:dq_icons).
// It keeps them in memory, so this goes again on every load. Nothing happens if Deepcore isn't installed.
system.runTimeout(() => {
  const dim = world.getDimension("overworld");
  dim.runCommand(`scriptevent dq:add_icon ${JSON.stringify({ entity: "rc:dq_icons", icons: { "rc:roasted_carrot": 1 } })}`);
  // Teaches Deepcore's Electric Furnace to roast carrots and puts carrots in its [Raw food] pipe filter.
  // ponytail: proposed in baseballr/Deepcore#9, not in Deepcore yet; match the payload to whatever ships.
  dim.runCommand(`scriptevent dq:add_smelt ${JSON.stringify({ in: "minecraft:carrot", out: "rc:roasted_carrot", filter: "#rawfood" })}`);
}, 20);
