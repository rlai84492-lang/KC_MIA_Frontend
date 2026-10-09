import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Short confirmation messages at the bottom of the screen (reference: .toast),
// e.g. "Dashboard refreshed" or "Copied 120 rows".
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  const toast = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
