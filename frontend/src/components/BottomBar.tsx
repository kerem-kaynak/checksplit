import { useEffect, useRef, useState, type ReactNode } from "react";

/** Reserve the bar's actual height, including wrapped text and the phone safe area. */
export function BottomBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.ceil(entry.target.getBoundingClientRect().height));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" style={{ height }} />
      <div
        ref={ref}
        className="fixed inset-x-0 bottom-0 z-20 max-h-[60dvh] overflow-y-auto border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-md space-y-3">{children}</div>
      </div>
    </>
  );
}
