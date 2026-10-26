// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App.jsx";

vi.mock("../lib/three-portal.js", () => ({ createThreePortal: () => ({ dispose() {}, reset() {}, setModel() {} }) }));
vi.mock("../lib/mediapipe.js", () => ({ ASSET_URL: "https://example.test", loadMediaPipe: vi.fn(async () => {}) }));

let root, container, getUserMedia, tracks, engines;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  tracks = [];
  engines = [];
  window.Hands = class {
    constructor() { this.close = vi.fn(); engines.push(this); }
    setOptions() {}
    onResults(callback) { this.results = callback; }
  };
  getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] };
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia,
    enumerateDevices: vi.fn(async () => [{ kind: "videoinput", deviceId: "first" }, { kind: "videoinput", deviceId: "second" }]),
  } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
async function mount() { await act(async () => root.render(<App />)); }
async function click(text) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent.includes(text));
  await act(async () => button.click());
}

test("camera selector opens the selected device and releases the previous camera", async () => {
  await mount();
  await click("START CAMERA");
  expect(getUserMedia.mock.calls[0][0].video.deviceId).toEqual({ exact: "first" });
  const select = container.querySelector("select");
  await act(async () => {
    select.value = "second";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(getUserMedia.mock.calls[1][0].video.deviceId).toEqual({ exact: "second" });
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  expect(engines[0].close).toHaveBeenCalledOnce();
});

test("camera permission failure releases the tracker and permits retry", async () => {
  getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
  await mount();
  await click("START CAMERA");
  expect(container.textContent).toContain("Permission denied");
  expect(engines[0].close).toHaveBeenCalledOnce();
  await click("START CAMERA");
  expect(container.textContent).toContain("One left pinch creates the portal");
});

test("demo cancels pending camera permission and stops a late stream", async () => {
  let resolveStream;
  const stop = vi.fn();
  getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { resolveStream = resolve; }));
  await mount();
  await click("START CAMERA");
  await click("TRY MOUSE DEMO");
  await act(async () => resolveStream({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Demo mode");
  expect(container.querySelector("video").srcObject).toBeNull();
});

test("a playback failure stops the acquired camera", async () => {
  HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error("Playback failed"));
  await mount();
  await click("START CAMERA");
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  expect(engines[0].close).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Playback failed");
});

test("unmount cancels pending permission and disposes a late camera stream", async () => {
  let resolveStream;
  const stop = vi.fn();
  getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { resolveStream = resolve; }));
  await mount();
  await click("START CAMERA");
  await act(async () => root.unmount());
  await act(async () => resolveStream({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
  expect(engines[0].close).toHaveBeenCalledOnce();
});
