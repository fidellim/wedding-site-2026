import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SeatingGuide } from "./SeatingGuide";
import { previewFixture } from "./previewFixtures";
import { flightProgress, flightViews, seatDestination } from "./flight";

vi.mock("../venue/VenueCanvas", () => ({
  VenueCanvas: (props: Parameters<typeof import("../venue/VenueCanvas").VenueCanvas>[0]) =>
    <><output data-testid="camera-request">{JSON.stringify(props.focusRequest)}</output><output data-testid="chair-numbers">{String(props.chairNumbers)}</output><output data-testid="crew-visible">{String(props.productionTables)}</output></>,
}));
afterEach(cleanup);
const request = async () => JSON.parse((await screen.findByTestId("camera-request")).textContent!);

it("automatically tours the couple’s table and supports replay and close-up without a seat number", async () => {
  render(<SeatingGuide data={previewFixture("couple", false)} />);
  expect(await request()).toMatchObject({ tour: true, view: "aerial", target: { eventFurniture: "couple" } });
  fireEvent.click(screen.getByRole("button", { name: "Close-up" }));
  expect(await request()).toMatchObject({ tour: false, view: "close-up", target: { eventFurniture: "couple" } });
  fireEvent.click(screen.getByRole("button", { name: "Show our table" }));
  expect((await request()).target).toEqual({ eventFurniture: "couple" });
});

it("uses the saved crew visibility in the guest 3D view", async () => {
  const data = previewFixture("single");
  data.snapshot.venueLayout!.productionTablesVisible = false;
  render(<SeatingGuide data={data} />);
  expect(await screen.findByTestId("crew-visible")).toHaveTextContent("false");
});

it("starts a single guest's aerial journey automatically", async () => {
  render(<SeatingGuide data={previewFixture("single")} />);
  expect(await request()).toMatchObject({ tour: true, view: "aerial", target: { tableId: "sample-round", seatNumber: 3 } });
  expect(screen.getByRole("button", { name: "Aerial" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("chair-numbers")).toHaveTextContent("false");
  expect(screen.getByRole("button", { name: /Alex\s*Table 1 · Seat 3/ })).toHaveAttribute("aria-pressed", "true");
});

it("starts with the first alphabetical assigned guest, supports close-up, and replays aerial", async () => {
  const data = previewFixture("split");
  data.snapshot.invitees.reverse();
  render(<SeatingGuide data={data} />);
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

it("skips alphabetically earlier guests without assigned seats", async () => {
  const data = previewFixture("split");
  data.snapshot.assignments = data.snapshot.assignments.filter(assignment => assignment.inviteeId !== "Alex");
  render(<SeatingGuide data={data} />);
  expect(await request()).toMatchObject({ tour: true, target: { tableId: "sample-long", seatNumber: 6 } });
  expect(screen.getByRole("button", { name: /Jamie\s*Table 2 · Seat 6/ })).toHaveAttribute("aria-pressed", "true");
});

it("starts with landmarks off and lets guests enable them", async () => {
  render(<SeatingGuide data={previewFixture("single")} />);
  await request();
  fireEvent.click(screen.getByRole("button", { name: "Views" }));
  const landmarks = screen.getByRole("button", { name: "Landmarks" });
  expect(landmarks).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(landmarks);
  expect(landmarks).toHaveAttribute("aria-pressed", "true");
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
  expect(screen.getByTestId("chair-numbers")).toHaveTextContent("false");
});

it("keeps queued frames before the automatic flight start inside the camera curve", () => {
  expect(flightProgress(99, 100)).toBe(0);
  expect(flightProgress(5100, 100)).toBe(.5);
  expect(flightProgress(10200, 100)).toBe(1);
});
