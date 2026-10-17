import { useEffect, useRef, type ReactNode } from 'react';

/** Fits a complete line to its container without truncating known or unknown information. */
export function HomeLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = container.current;
    const line = text.current;
    if (!box || !line) return;
    const fit = () => {
      line.style.fontSize = '';
      const size = parseFloat(getComputedStyle(line).fontSize);
      const runs = line.querySelectorAll<HTMLElement>('[data-fit-run]');
      const width = runs.length
        ? Math.max(...Array.from(runs, (run) => run.getBoundingClientRect().width))
        : line.getBoundingClientRect().width;
      if (width > box.clientWidth && box.clientWidth > 0) {
        line.style.fontSize = `${size * box.clientWidth / width * .98}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    let active = true;
    const refit = () => { if (active) fit(); };
    void document.fonts.ready.then(refit);
    document.fonts.addEventListener('loadingdone', refit);
    fit();
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', refit); };
  }, [children]);
  return <div ref={container} className={`home-line ${className}`}><span ref={text}>{children}</span></div>;
}