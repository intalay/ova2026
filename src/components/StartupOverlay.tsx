import { useLayoutEffect, useRef, useState } from "react";
import logo from "@/assets/ova-logo.png.asset.json";

const SESSION_KEY = "ova-startup-played:v1";
type StartupWindow = Window & { __ovaStartupPlayed?: boolean };

function claimStartup() {
  const tab = window as StartupWindow;
  if (tab.__ovaStartupPlayed) return false;
  tab.__ovaStartupPlayed = true;
  try {
    if (tab.sessionStorage.getItem(SESSION_KEY) === "1") return false;
    // Claim at the start: an interrupted launch must not replay on the next mount.
    tab.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Blocked/full storage still gets one launch in this document, including HMR.
  }
  return true;
}

/** SSR and the first client render are empty; only a fresh tab session starts motion. */
export function StartupOverlay() {
  const [visible, setVisible] = useState(false);
  const deadline = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (deadline.current === null) {
      if (!claimStartup()) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      deadline.current = performance.now() + (reduced ? 450 : 2700);
    }
    // StrictMode/Refresh can rerun the effect; keep this instance's original deadline.
    const remaining = deadline.current - performance.now();
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      deadline.current = 0;
      setVisible(false);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="startup-overlay" aria-hidden="true" data-startup-overlay>
      <img
        className="startup-logo"
        src={logo.url}
        width={272}
        height={381}
        alt=""
        fetchPriority="high"
      />
      <div className="startup-wave" />
      <div className="startup-ball-flight">
        <svg className="startup-ball" viewBox="0 0 100 100" fill="none">
          <defs>
            <clipPath id="startup-ball-clip">
              <circle cx="50" cy="50" r="48" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="48" className="startup-ball-light" />
          <g clipPath="url(#startup-ball-clip)" className="startup-ball-green">
            <path d="M50 50C28 48 9 29 8 12L28 0C25 22 36 40 50 50Z M50 50C59 29 81 14 98 15L100 40C78 33 61 40 50 50Z M50 50C65 67 69 89 60 103L36 100C49 84 52 66 50 50Z" />
            <g className="startup-ball-seams">
              <path d="M50 50C21 47 3 26 4 4M50 50C55 22 80 7 102 13M50 50C69 71 70 94 55 106M28 0C24 20 35 41 50 50M100 40C79 33 62 39 50 50M36 100C50 83 53 64 50 50" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
