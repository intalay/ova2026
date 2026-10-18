import { useEffect, useState } from 'react';
import logo from '@/assets/ova-logo.png.asset.json';

/** Root-mounted and never keyed to navigation. Initial markup is identical on server and client. */
export function StartupOverlay() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 450 : 2700);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="startup-overlay" aria-hidden="true" data-startup-overlay>
    <img className="startup-logo" src={logo.url} width={272} height={381} alt="" fetchPriority="high" />
    <div className="startup-wave" />
    <div className="startup-ball-flight">
      <svg className="startup-ball" viewBox="0 0 100 100" fill="none">
        <defs><clipPath id="startup-ball-clip"><circle cx="50" cy="50" r="48" /></clipPath></defs>
        <circle cx="50" cy="50" r="48" className="startup-ball-light" />
        <g clipPath="url(#startup-ball-clip)" className="startup-ball-green">
          <path d="M50 50C28 48 9 29 8 12L28 0C25 22 36 40 50 50Z M50 50C59 29 81 14 98 15L100 40C78 33 61 40 50 50Z M50 50C65 67 69 89 60 103L36 100C49 84 52 66 50 50Z" />
          <g className="startup-ball-seams"><path d="M50 50C21 47 3 26 4 4M50 50C55 22 80 7 102 13M50 50C69 71 70 94 55 106M28 0C24 20 35 41 50 50M100 40C79 33 62 39 50 50M36 100C50 83 53 64 50 50" /></g>
        </g>
      </svg>
    </div>
  </div>;
}
