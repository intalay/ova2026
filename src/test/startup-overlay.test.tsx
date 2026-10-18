import { StrictMode } from "react";
import { act, render, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StartupOverlay } from "@/components/StartupOverlay";

const SESSION_KEY = "ova-startup-played:v1";
type StartupWindow = Window & { __ovaStartupPlayed?: boolean };
const overlay = (container: Element) => container.querySelector("[data-startup-overlay]");
function newDocument() {
  delete (window as StartupWindow).__ovaStartupPlayed;
}
function motion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced })),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  newDocument();
  sessionStorage.removeItem(SESSION_KEY);
  motion(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  newDocument();
  sessionStorage.removeItem(SESSION_KEY);
});

it("plays once for 2.7 seconds and does not replay on rerender", () => {
  const view = render(<StartupOverlay />);
  expect(overlay(view.container)).not.toBeNull();
  expect(sessionStorage.getItem(SESSION_KEY)).toBe("1");
  act(() => vi.advanceTimersByTime(2699));
  expect(overlay(view.container)).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(overlay(view.container)).toBeNull();
  view.rerender(<StartupOverlay />);
  expect(overlay(view.container)).toBeNull();
});

it("uses a 450ms reduced-motion launch", () => {
  motion(true);
  const view = render(<StartupOverlay />);
  act(() => vi.advanceTimersByTime(449));
  expect(overlay(view.container)).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(overlay(view.container)).toBeNull();
});

it("StrictMode effect replay does not skip the first launch or reset its deadline", () => {
  const set = vi.spyOn(window, "setTimeout");
  const view = render(
    <StrictMode>
      <StartupOverlay />
    </StrictMode>,
  );
  const node = overlay(view.container);
  expect(node).not.toBeNull();
  expect(view.container.querySelectorAll("[data-startup-overlay]")).toHaveLength(1);
  expect(set.mock.calls.filter((call) => call[1] === 2700)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(2699));
  expect(overlay(view.container)).toBe(node);
  act(() => vi.advanceTimersByTime(1));
  expect(overlay(view.container)).toBeNull();
});

it("marks the session at launch so interrupting and truly remounting cannot replay", () => {
  const first = render(<StartupOverlay />);
  act(() => vi.advanceTimersByTime(1000));
  first.unmount();
  const second = render(<StartupOverlay />);
  expect(overlay(second.container)).toBeNull();
  act(() => vi.advanceTimersByTime(5400));
  expect(overlay(second.container)).toBeNull();
});

it("a completed launch remains skipped after a true root remount", () => {
  const first = render(<StartupOverlay />);
  act(() => vi.advanceTimersByTime(2700));
  first.unmount();
  const second = render(<StartupOverlay />);
  expect(overlay(second.container)).toBeNull();
});

it("a refreshed document with the same tab session skips without starting a timer", () => {
  const first = render(<StartupOverlay />);
  first.unmount();
  newDocument(); // A reload loses the Window fallback, while sessionStorage survives.
  const set = vi.spyOn(window, "setTimeout");
  const second = render(<StartupOverlay />);
  expect(overlay(second.container)).toBeNull();
  expect(set.mock.calls.some((call) => call[1] === 2700 || call[1] === 450)).toBe(false);
});

it("an independent fresh tab session plays, while an inherited session marker skips", () => {
  sessionStorage.setItem(SESSION_KEY, "1"); // Duplicate/opener tabs may copy storage.
  const inherited = render(<StartupOverlay />);
  expect(overlay(inherited.container)).toBeNull();
  inherited.unmount();
  newDocument();
  sessionStorage.removeItem(SESSION_KEY);
  const fresh = render(<StartupOverlay />);
  expect(overlay(fresh.container)).not.toBeNull();
});

it("login and route content rerenders do not replay, including after session completion", () => {
  function App({ identity, route }: { identity: string; route: string }) {
    return (
      <>
        <section>
          {identity} · {route}
        </section>
        <StartupOverlay />
      </>
    );
  }
  const view = render(<App identity="guest" route="/" />);
  const node = overlay(view.container);
  act(() => vi.advanceTimersByTime(1000));
  view.rerender(<App identity="player" route="/account" />);
  expect(overlay(view.container)).toBe(node);
  act(() => vi.advanceTimersByTime(1700));
  expect(overlay(view.container)).toBeNull();
  view.rerender(<App identity="family" route="/announcements" />);
  expect(overlay(view.container)).toBeNull();
});

it("keeps server and initial client markup empty and hydrates a fresh session without mismatch", async () => {
  const markup = renderToString(<StartupOverlay />);
  expect(markup).toBe("");
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect((window as StartupWindow).__ovaStartupPlayed).toBeUndefined();
  const container = document.createElement("div");
  container.innerHTML = markup;
  document.body.append(container);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <StartupOverlay />, { onRecoverableError });
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(overlay(container)).not.toBeNull();
  act(() => vi.advanceTimersByTime(2700));
  expect(overlay(container)).toBeNull();
  await act(async () => root.unmount());
  container.remove();
});

it("hydrates a previously played session without inserting an overlay or reporting mismatch", async () => {
  sessionStorage.setItem(SESSION_KEY, "1");
  const container = document.createElement("div");
  container.innerHTML = renderToString(<StartupOverlay />);
  document.body.append(container);
  const onRecoverableError = vi.fn();
  const inserted: Node[] = [];
  const observer = new MutationObserver((records) =>
    records.forEach((record) => inserted.push(...record.addedNodes)),
  );
  observer.observe(container, { childList: true, subtree: true });
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <StartupOverlay />, { onRecoverableError });
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(overlay(container)).toBeNull();
  expect(
    inserted.some((node) => node instanceof Element && node.matches("[data-startup-overlay]")),
  ).toBe(false);
  observer.disconnect();
  await act(async () => root.unmount());
  container.remove();
});

it("does not share a launch claim across server renders", () => {
  expect(renderToString(<StartupOverlay />)).toBe("");
  expect(renderToString(<StartupOverlay />)).toBe("");
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect((window as StartupWindow).__ovaStartupPlayed).toBeUndefined();
});

it("blocked storage getters fall back to one launch in this document without crashing", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  const first = render(<StartupOverlay />);
  expect(overlay(first.container)).not.toBeNull();
  first.unmount();
  const second = render(<StartupOverlay />);
  expect(overlay(second.container)).toBeNull();
});

it("failed storage writes still prevent a replay in the same document", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  const first = render(<StartupOverlay />);
  expect(overlay(first.container)).not.toBeNull();
  first.unmount();
  const second = render(<StartupOverlay />);
  expect(overlay(second.container)).toBeNull();
});

it("clears the timer on unmount and leaves content interactive underneath", () => {
  const set = vi.spyOn(window, "setTimeout");
  const clear = vi.spyOn(window, "clearTimeout");
  const view = render(
    <>
      <button>Continue</button>
      <StartupOverlay />
    </>,
  );
  const node = overlay(view.container);
  expect(node).toHaveAttribute("aria-hidden", "true");
  expect(view.getByRole("button", { name: "Continue" })).toBeEnabled();
  const launchTimer = set.mock.results[set.mock.calls.findIndex((call) => call[1] === 2700)]?.value;
  view.unmount();
  expect(launchTimer).toBeDefined();
  expect(clear).toHaveBeenCalledWith(launchTimer);
});
