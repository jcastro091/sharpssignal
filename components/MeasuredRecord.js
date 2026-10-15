import { useEffect, useRef } from "react";
import { analyticsAllowed } from "../lib/analyticsConsent";
import { trackFunnelEvent } from "../lib/funnelClient";
// A real released record must remain at least half visible for five seconds.
// Hidden tabs and declined consent never qualify. The server verifies the feed receipt.
export default function MeasuredRecord({ proof, children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!proof || !window.IntersectionObserver) return;
    let timer,
      visible = false,
      sent = false;
    function reset() {
      clearTimeout(timer);
      timer = null;
    }
    function check() {
      reset();
      if (
        !sent &&
        visible &&
        analyticsAllowed() &&
        document.visibilityState === "visible"
      )
        timer = setTimeout(() => {
          if (!analyticsAllowed() || document.visibilityState !== "visible")
            return;
          sent = true;
          trackFunnelEvent("record_view", { record_proof: proof });
        }, 5000);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.intersectionRatio >= 0.5;
        check();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("ss-consent", check);
    return () => {
      reset();
      observer.disconnect();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("ss-consent", check);
    };
  }, [proof]);
  return (
    <article ref={ref} {...props}>
      {children}
    </article>
  );
}
