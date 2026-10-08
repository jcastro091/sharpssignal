import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function CheckoutStatus() {
  const router = useRouter();
  const { checkout, session_id: sessionId } = router.query;
  const [state, setState] = useState("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (checkout !== "success" || typeof sessionId !== "string") return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    setState("loading");
    fetch(
      "/api/stripe/verify-success?session_id=" + encodeURIComponent(sessionId),
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        setState(
          response.ok &&
            body.ok &&
            body.paymentVerified &&
            body.fulfillment === "not_activated"
            ? "verified"
            : "error",
        );
      })
      .catch(() => {
        if (active) setState("error");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [checkout, sessionId, retry]);
  if (!checkout) return null;
  if (checkout === "cancelled")
    return (
      <section className="member-panel" role="status">
        Checkout was cancelled. Paid access is not activated.
      </section>
    );
  if (checkout !== "success") return null;
  const invalid =
    typeof sessionId !== "string" ||
    !/^cs_[A-Za-z0-9_]{1,200}$/.test(sessionId);
  return (
    <section className="member-panel" aria-label="Checkout status">
      {invalid || state === "error" ? (
        <>
          <p role="alert">
            We could not verify this checkout for your account. No paid access
            has been granted.
          </p>
          {!invalid && (
            <button
              className="button-secondary"
              onClick={() => setRetry((x) => x + 1)}
            >
              Retry verification
            </button>
          )}
        </>
      ) : (
        <p role="status">
          {state === "verified"
            ? "Payment verified. Paid fulfillment and Telegram invitations are not activated. Contact support if you need help with an existing payment."
            : "Checking checkout status…"}
        </p>
      )}
    </section>
  );
}
