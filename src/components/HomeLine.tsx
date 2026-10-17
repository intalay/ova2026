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
      const width = line.getBoundingClientRect().width;
      if (width > box.clientWidth && box.clientWidth > 0) {
        line.style.fontSize = `${size * box.clientWidth / width}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    fit();
    return () => { active = false; observer.disconnect(); };
  }, [children]);
  return <div ref={container} className={`home-line ${className}`}><span ref={text}>{children}</span></div>;
}