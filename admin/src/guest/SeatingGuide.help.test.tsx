import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { SeatingGuide } from "./SeatingGuide";
import { previewFixture } from "./previewFixtures";

vi.mock("../venue/VenueCanvas", () => ({
  VenueCanvas: (props: Parameters<typeof import("../venue/VenueCanvas").VenueCanvas>[0]) =>
    <output data-testid="camera-request">{JSON.stringify(props.focusRequest)}</output>,
}));
// jsdom has no dialog implementation; real focus trapping is verified in Chromium.
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true; this.querySelector("button")?.focus(); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event("close")); } },
  });
});
afterEach(cleanup);
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

it("replaces persistent hints with help, closes guest details, and restores focus", async () => {
  const { container } = render(<SeatingGuide data={previewFixture("single")} />);
  await screen.findByTestId("camera-request");
  fireEvent.click(screen.getByRole("button", { name: "Views" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Explore tables" }), { target: { value: "sample-round" } });
  expect(screen.getByRole("region", { name: "Seating details" })).toBeVisible();
  const help = screen.getByRole("button", { name: "Seating guide help" });
  fireEvent.click(help);
  expect(container.querySelector(".guide-scene-note")).toBeNull();
  expect(screen.queryByRole("region", { name: "Seating details" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Views" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("dialog", { name: "Explore the seating guide" })).toHaveTextContent("Drag to rotate");
  expect(screen.getByRole("dialog")).toHaveTextContent("positions are approximate");
  expect(screen.getByTestId("camera-request")).toHaveTextContent("null");
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(help).toHaveFocus();
});

it("dismisses help with Escape and explains the chair approval gate", async () => {
  render(<SeatingGuide data={previewFixture("single", false)} />);
  await screen.findByTestId("camera-request");
  const toggle = screen.getByRole("button", { name: "Your seats" });
  const expanded = toggle.getAttribute("aria-expanded");
  const help = screen.getByRole("button", { name: "Seating guide help" });
  fireEvent.click(help);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Individual chair locations will appear once their positions are confirmed");
  expect(toggle).toHaveAttribute("aria-expanded", expanded);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(help).toHaveFocus();
});
