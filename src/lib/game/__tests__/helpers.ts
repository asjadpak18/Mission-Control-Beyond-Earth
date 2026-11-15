/**
 * Shared test helpers — config builder used by every test file.
 */

import { SpacecraftConfig } from "../types";
import { withQuantity, emptyConfig } from "../calculations";

export function config(missionId: string, entries: Array<[string, number]>): SpacecraftConfig {
  let cfg = emptyConfig(missionId);
  for (const [id, qty] of entries) cfg = withQuantity(cfg, id, qty);
  return cfg;
}
