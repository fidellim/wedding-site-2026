import { expect, it } from "vitest";
import { guestGuideLink, legacyGuideDestination } from "./guideLink";

it("opens newly issued party seating links on the guide route", () => {
  const url = guestGuideLink("http://localhost:5173", "SAMPLE", "sample-private-token");
  expect(url.pathname).toBe("/seating/");
  expect(url.searchParams.get("code")).toBe("SAMPLE");
  expect(url.searchParams.get("seating")).toBe("sample-private-token");
});

it("routes existing invitation-path seating links to that party's guide", () => {
  const destination = legacyGuideDestination(new URL("http://localhost:5173/?code=SAMPLE&seating=sample-private-token"))!;
  expect(destination?.pathname).toBe("/seating/");
  expect(destination?.searchParams.get("code")).toBe("SAMPLE");
  expect(destination?.searchParams.get("seating")).toBe("sample-private-token");
});

it.each(["/?code=SAMPLE", "/?seating=sample-token", "/?code=SAMPLE&seating=", "/seating/?code=SAMPLE&seating=sample-token"])("leaves ordinary invitations and guide routes alone: %s", path => {
  expect(legacyGuideDestination(new URL(path, "http://localhost:5173"))).toBeNull();
});
