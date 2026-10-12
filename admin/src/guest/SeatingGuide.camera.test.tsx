import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SeatingGuide } from "./SeatingGuide";
import { previewFixture } from "./previewFixtures";
import { flightProgress, flightViews, seatDestination } from "./flight";

vi.mock("../venue/VenueCanvas", () => ({
  VenueCanvas: (props: Parameters<typeof import("../venue/VenueCanvas").VenueCanvas>[0]) =>
    <output data-testid="camera-request">{JSON.stringify(props.focusRequest)}</output>,
}));
afterEach(cleanup);
const request = async () => JSON.parse((await screen.findByTestId("camera-request")).textContent!);

it("starts a single guest's aerial journey automatically", async () => {
  render(<SeatingGuide data={previewFixture("single")} />);
  expect(await request()).toMatchObject({ tour: true, view: "aerial", target: { tableId: "sample-round", seatNumber: 3 } });
  expect(screen.getByRole("button", { name: "Aerial" })).toHaveAttribute("aria-pressed", "true");
});

it("waits for a party member, supports close-up, and replays aerial for the selected guest", async () => {
  render(<SeatingGuide data={previewFixture("split")} />);
  expect(await request()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ }));
  expect(await request()).toMatchObject({ tour: true, view: "aerial", target: { seatNumber: 3 } });
  fireEvent.click(screen.getByRole("button", { name: "Close-up" }));
  expect(await request()).toMatchObject({ tour: false, view: "close-up" });
  fireEvent.click(screen.getByRole("button", { name: /Jamie\s*Table 2 · Seat 6/ }));
  expect(await request()).toMatchObject({ tour: false, view: "close-up", target: { tableId: "sample-long", seatNumber: 6 } });
  fireEvent.click(screen.getByRole("button", { name: "Aerial" }));
  const replay = await request();
  expect(replay).toMatchObject({ tour: true, view: "aerial", target: { seatNumber: 6 } });
  fireEvent.click(screen.getByRole("button", { name: "Show my seat" }));
  expect((await request()).key).toBeGreaterThan(replay.key);
});

it("frames the table from above for aerial and the exact chair for close-up", () => {
  const { snapshot } = previewFixture("split"), layout = snapshot.venueLayout!;
  const target = { tableId: "sample-long", seatNumber: 6 };
  const aerial = seatDestination(snapshot, layout, target, 1.5, "aerial")!;
  const close = seatDestination(snapshot, layout, target, 1.5, "close-up")!;
  expect(aerial.target).toEqual([5, 4, .4]);
  expect(close.target).not.toEqual(aerial.target);
  expect(aerial.position[2]).toBeGreaterThan(close.position[2]);
  expect(flightViews(snapshot, layout, target, 1.5, "aerial")?.at(-1)).toEqual(aerial);
});

it("keeps unapproved chair arrangements focused on the table", async () => {
  render(<SeatingGuide data={previewFixture("single", false)} />);
  expect((await request()).target).toEqual({ tableId: "sample-round" });
});

it("keeps queued frames before the automatic flight start inside the camera curve", () => {
  expect(flightProgress(99, 100)).toBe(0);
  expect(flightProgress(5100, 100)).toBe(.5);
  expect(flightProgress(10200, 100)).toBe(1);
});
