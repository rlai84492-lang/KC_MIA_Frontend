import { useEffect, useRef } from "react";

// Calls `callback` now, then every `intervalMs` while the browser tab is visible.
// Pauses while the tab is hidden and calls again as soon as it becomes visible.
// Restarts whenever a value in `deps` changes.
// options.immediate = false skips the first call on start (used by auto-refresh: pages load themselves).
export function usePolling(callback, intervalMs, deps = [], { immediate = true } = {}) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    let timer = null;
    const run = () => saved.current();
    const start = () => {
      clearInterval(timer);
      timer = setInterval(run, intervalMs);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        run();
        start();
      }
    };

    if (immediate) run();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, immediate, ...deps]);
}
