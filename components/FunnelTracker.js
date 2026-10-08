import { useEffect } from "react";
import { useRouter } from "next/router";
import { trackFunnelEvent } from "../lib/funnelClient";
import { analyticsAllowed } from "../lib/analyticsConsent";
const { PRIVATE_PATHS, safePath } = require("../lib/measurement.cjs");
export default function FunnelTracker() {
  const router = useRouter();
  useEffect(() => {
    let cleanup = () => {};
    function start() {
      cleanup();
      if (!analyticsAllowed()) return;
      const path = safePath(location.pathname);
      if (PRIVATE_PATHS.test(path)) return;
      const article = path.startsWith("/blog/") ? path.split("/").pop() : "";
      const device = innerWidth < 768 ? "mobile" : "desktop";
      const revision = "2026-10-08-v1";
      const send = (name, data = {}) =>
        trackFunnelEvent(name, { article, device, revision, ...data });
      send("page_view");
      const stage =
        path === "/"
          ? "landing_view"
          : path === "/signup"
            ? "signup_view"
            : path === "/billing" || path === "/subscribe"
              ? "plan_view"
              : path === "/dashboard"
                ? "dashboard_view"
                : path === "/picks-preview"
                  ? "picks_preview_view"
                  : article
                    ? "article_view"
                    : null;
      if (stage) send(stage);
      let active = 0,
        last = Date.now(),
        lastInput = Date.now(),
        engaged = false,
        articleEngaged = false,
        clicks = 0;
      const depths = new Set();
      function scroll() {
        lastInput = Date.now();
        const height = document.documentElement.scrollHeight;
        const depth = Math.min(
          100,
          Math.round(((scrollY + innerHeight) / Math.max(height, 1)) * 100),
        );
        for (const threshold of [25, 50, 75, 90])
          if (depth >= threshold && !depths.has(threshold)) {
            depths.add(threshold);
            send("scroll_depth", { depth: threshold });
          }
      }
      function click(e) {
        lastInput = Date.now();
        if (
          clicks++ >= 80 ||
          e.target.closest(
            "input,textarea,select,[contenteditable],form,[data-private]",
          )
        )
          return;
        const el = e.target.closest("a,button,[data-track]");
        const href = el?.getAttribute("href") || "";
        const dest = href.startsWith("/")
          ? safePath(href)
          : href.startsWith("mailto:")
            ? "email"
            : href
              ? "external"
              : "";
        send("site_click", {
          target:
            el?.getAttribute("data-track") ||
            dest ||
            el?.tagName?.toLowerCase() ||
            "page",
          destination: dest,
          x: Math.min(99, Math.floor((e.clientX / innerWidth) * 100)),
          y: Math.min(
            99,
            Math.floor(
              ((e.clientY + scrollY) / document.documentElement.scrollHeight) *
                100,
            ),
          ),
          viewport_width: innerWidth,
          document_height: document.documentElement.scrollHeight,
        });
        if (dest === "/signup") send("signup_click");
      }
      const timer = setInterval(() => {
        const now = Date.now();
        if (document.visibilityState === "visible" && now - lastInput < 60000)
          active += Math.min(now - last, 1500);
        last = now;
        if (active >= 30000 && !engaged) {
          engaged = true;
          send("page_engaged", { seconds: 30 });
        }
        if (article && active >= 30000 && depths.has(75) && !articleEngaged) {
          articleEngaged = true;
          send("article_engaged", { seconds: 30, depth: 75 });
        }
      }, 1000);
      const input = () => {
        lastInput = Date.now();
      };
      const error = () => send("client_error", { target: "runtime_error" });
      document.addEventListener("click", click);
      window.addEventListener("scroll", scroll, { passive: true });
      window.addEventListener("keydown", input);
      window.addEventListener("error", error);
      scroll();
      cleanup = () => {
        clearInterval(timer);
        document.removeEventListener("click", click);
        window.removeEventListener("scroll", scroll);
        window.removeEventListener("keydown", input);
        window.removeEventListener("error", error);
      };
    }
    const route = () => requestAnimationFrame(start);
    start();
    router.events.on("routeChangeComplete", route);
    window.addEventListener("ss-consent", start);
    return () => {
      cleanup();
      router.events.off("routeChangeComplete", route);
      window.removeEventListener("ss-consent", start);
    };
  }, [router.events]);
  return null;
}
