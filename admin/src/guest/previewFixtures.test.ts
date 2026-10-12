import { expect, it } from "vitest";
import { previewFixture } from "./previewFixtures";

it.each(["single", "split"] as const)("makes assigned chairs available in the %s development preview", kind => {
  const preview = previewFixture(kind);
  expect(preview.chairsApproved).toBe(true);
  expect(preview.snapshot.assignments).toHaveLength(kind === "single" ? 1 : 2);
});
