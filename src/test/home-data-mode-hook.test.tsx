import { act, cleanup, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { resetHomeDataMode, useHomeDataMode } from "@/hooks/use-home-data-mode";
it("shares across homepage/Results consumers, has a Real SSR snapshot, and handles the shared identity reset while routes are unmounted", () => {
  const first = renderHook(() => useHomeDataMode({ user: { id: "alex" }, ready: true }));
  const second = renderHook(() => useHomeDataMode({ user: { id: "alex" }, ready: true }));
  expect(first.result.current.mode).toBe("real");
  act(() => first.result.current.setMode("synthetic"));
  expect(second.result.current.mode).toBe("synthetic");
  function ServerView() {
    return <span>{useHomeDataMode({ user: { id: "alex" }, ready: true }).mode}</span>;
  }
  expect(renderToString(<ServerView />)).toBe("<span>real</span>");
  cleanup();
  act(() => resetHomeDataMode());
  const login = renderHook(() => useHomeDataMode({ user: { id: "alex" }, ready: true }));
  expect(login.result.current.mode).toBe("real");
  act(() => login.result.current.setMode("synthetic"));
  login.rerender();
  cleanup();
  act(() => resetHomeDataMode());
  const switched = renderHook(() => useHomeDataMode({ user: { id: "jordan" }, ready: true }));
  expect(switched.result.current.mode).toBe("real");
  cleanup();
});
