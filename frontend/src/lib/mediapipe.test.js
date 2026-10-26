// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { loadMediaPipe, ASSET_URL } from "./mediapipe.js";

afterEach(() => {
  delete window.Hands;
  document.head.innerHTML = "";
  vi.useRealTimers();
});

test("failed tracker downloads can be retried and concurrent loads share a request", async () => {
  const first = loadMediaPipe();
  expect(loadMediaPipe()).toBe(first);
  const rejected = expect(first).rejects.toThrow("MediaPipe could not load");
  document.head.querySelector("script").dispatchEvent(new Event("error"));
  await rejected;
  expect(document.head.querySelector("script")).toBeNull();
  const retry = loadMediaPipe();
  expect(document.head.querySelector("script").src).toBe(`${ASSET_URL}/hands.js`);
  window.Hands = class {};
  document.head.querySelector("script").dispatchEvent(new Event("load"));
  await retry;
});

test("tracker requests time out instead of hanging indefinitely", async () => {
  vi.useFakeTimers();
  const rejected = expect(loadMediaPipe()).rejects.toThrow("MediaPipe could not load");
  await vi.advanceTimersByTimeAsync(30000);
  await rejected;
  expect(document.head.querySelector("script")).toBeNull();
});
