import { useEffect, useRef } from "react";

// One hover tooltip for the whole app (reference: #tip). Any element with a `data-tip` attribute gets it.
// The first line of `data-tip` is shown in bold; further lines are separated by "\n". Text only, never HTML.
export default function Tooltip() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    let current = null;

    const onMove = (e) => {
      const target = e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!target) {
        el.hidden = true;
        current = null;
        return;
      }
      const text = target.getAttribute("data-tip");
      if (text !== current) {
        current = text;
        const [title, ...lines] = text.split("\n");
        const b = document.createElement("b");
        b.textContent = title;
        el.replaceChildren(b, ...lines.flatMap((line) => [document.createElement("br"), line]));
      }
      el.hidden = false;
      let x = e.clientX + 14;
      let y = e.clientY + 14;
      if (x + el.offsetWidth > window.innerWidth - 8) x = e.clientX - el.offsetWidth - 14;
      if (y + el.offsetHeight > window.innerHeight - 8) y = e.clientY - el.offsetHeight - 14;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const hide = () => { el.hidden = true; };

    document.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  return <div ref={ref} className="tip" role="tooltip" hidden />;
}
