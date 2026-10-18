import { act, cleanup, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
const auth = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        auth.callback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
import { useHomeDataMode } from "@/hooks/use-home-data-mode";
it("shares across homepage/Results consumers, has a Real SSR snapshot, and observes logout while routes are unmounted", () => {
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
  act(() => auth.callback?.("SIGNED_OUT", null));
  const login = renderHook(() => useHomeDataMode({ user: { id: "alex" }, ready: true }));
  expect(login.result.current.mode).toBe("real");
  act(() => login.result.current.setMode("synthetic"));
  login.rerender();
  cleanup();
  act(() => auth.callback?.("SIGNED_IN", { user: { id: "jordan" } }));
  const switched = renderHook(() => useHomeDataMode({ user: { id: "jordan" }, ready: true }));
  expect(switched.result.current.mode).toBe("real");
  cleanup();
});
