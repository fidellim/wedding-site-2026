import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VenueCanvas } from "./VenueCanvas";
import { previewFixture } from "../guest/previewFixtures";

const gpu = vi.hoisted(() => ({ compile: vi.fn(), render: vi.fn() }));
vi.mock("three", async importOriginal => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement("canvas");
    shadowMap = {};
    capabilities = { getMaxAnisotropy: () => 1 };
    setPixelRatio() {}
    setSize() {}
    compileAsync = gpu.compile;
    render = gpu.render;
    dispose() {}
    forceContextLoss() {}
  } };
});
vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const { Vector3 } = await import("three");
  return { OrbitControls: class {
    target = new Vector3();
    cursor = new Vector3();
    update() {}
    addEventListener() {}
    removeEventListener() {}
    dispose() {}
  } };
});
vi.mock("./buildVenue", async () => {
  const { Group, Texture } = await import("three");
  return { buildVenue: () => ({ root: new Group(), weddingLayout: new Group(), waterTexture: new Texture(), dispose() {} }) };
});
vi.mock("./buildFurniture", async () => {
  const { Group } = await import("three");
  return { buildFurniture: () => ({ root: new Group(), dispose() {} }) };
});
vi.mock("./buildCeremony", async () => {
  const { Group } = await import("three");
  return { buildCeremony: () => ({ root: new Group(), dispose() {} }) };
});
let finishCompilation: () => void;
let failCompilation: (error: Error) => void;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  gpu.render.mockReset();
  gpu.compile.mockReset().mockImplementation(() => new Promise<void>((resolve, reject) => {
    finishCompilation = resolve; failCompilation = reject;
  }));
  frames = new Map(); nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function drawFrame(now: number) {
  act(() => {
    const queued = [...frames.values()]; frames.clear();
    queued.forEach(callback => callback(now));
  });
}
function showVenue() {
  const { snapshot } = previewFixture("single"), layout = snapshot.venueLayout!;
  const onTourLabel = vi.fn(), onUnavailable = vi.fn();
  const props = { parameters: layout.parameters, led: layout.led, preset: "overview" as const, resetKey: 0,
    labels: false, dusk: false, snapshot, layout, onUnavailable, onTourLabel,
    focusRequest: { target: { tableId: "sample-round", seatNumber: 3 }, tour: true, key: 1 } };
  return { ...render(<VenueCanvas {...props} />), props, onTourLabel, onUnavailable };
}

it("waits for shader readiness and a complete stationary frame before starting the journey", async () => {
  const { onTourLabel, onUnavailable } = showVenue();
  await act(async () => {});
  expect(screen.getByRole("status")).toHaveTextContent("Preparing the venue");
  drawFrame(100);
  expect(gpu.render).not.toHaveBeenCalled();
  expect(onTourLabel).not.toHaveBeenCalledWith("Ceremony approach");

  await act(async () => { finishCompilation(); });
  drawFrame(200);
  expect(gpu.render).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  expect(onTourLabel).not.toHaveBeenCalledWith("Ceremony approach");

  drawFrame(240);
  expect(onTourLabel).toHaveBeenCalledWith("Ceremony approach");
  expect(screen.getByRole("button", { name: "Skip to my seat" })).toBeVisible();
  expect(onUnavailable).not.toHaveBeenCalled();
});

it("cancels a queued journey when the user cancels it during preparation", async () => {
  const { props, rerender, onTourLabel } = showVenue();
  await act(async () => {});
  rerender(<VenueCanvas {...props} focusRequest={null} />);
  await act(async () => { finishCompilation(); });
  drawFrame(200); drawFrame(240);
  expect(gpu.render).toHaveBeenCalled();
  expect(onTourLabel).not.toHaveBeenCalledWith("Ceremony approach");
});

it("falls back when the graphics preparation fails", async () => {
  const { onUnavailable, onTourLabel } = showVenue();
  await act(async () => {});
  await act(async () => { failCompilation(new Error("Graphics unavailable")); });
  drawFrame(200);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
  expect(gpu.render).not.toHaveBeenCalled();
  expect(onTourLabel).not.toHaveBeenCalledWith("Ceremony approach");
});

it("honors reduced motion after the venue is ready", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { onTourLabel } = showVenue();
  await act(async () => {});
  await act(async () => { finishCompilation(); });
  drawFrame(200); drawFrame(240);
  expect(gpu.render).toHaveBeenCalledTimes(2);
  expect(onTourLabel).not.toHaveBeenCalledWith("Ceremony approach");
  expect(screen.queryByRole("button", { name: "Skip to my seat" })).toBeNull();
});
