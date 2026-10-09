const {LABELS}=require('../lib/productAccess.cjs');
import {
  getFirstTouch,
  getVisitorId,
  getSessionId,
  trackFunnelEvent,
} from "../lib/funnelClient";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Stripe from "stripe";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { getSafeNext } from "../lib/authRedirect";
const { checkoutOffer } = require("../lib/checkoutOffer.cjs");
export async function getServerSideProps(ctx) {
  const client = createPagesServerClient(ctx);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email_confirmed_at)
    return {
      redirect: {
        destination:
          "/signin?next=" +
          encodeURIComponent(getSafeNext(ctx.resolvedUrl || "/billing")),
        permanent: false,
      },
    };
  let offer = null;
  if (
    process.env.PAID_CHECKOUT_ENABLED === "true" &&
    process.env.STRIPE_SECRET_KEY
  ) {
    try {
      offer = await checkoutOffer(
        new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2025-06-30.basil",
          timeout: 10000,
          maxNetworkRetries: 0,
        }),
      );
    } catch {}
  }
  return {
    props: {
      offer,
      initialProducts: (user.user_metadata?.interests || ["sports","markets"]).filter(p=>["sports","markets"].includes(p)),
      qaEnabled:
        process.env.QA_CHECKOUT_ENABLED === "true" &&
        user.id === process.env.QA_CHECKOUT_USER_ID,
    },
  };
}
const errors = {
  payment_not_verified:
    "We could not confirm this payment. If you completed checkout, wait a moment and try again. Do not pay again.",
  payment_verification_unavailable:
    "Payment verification is temporarily unavailable. Your free dashboard is still available. Please retry.",
  checkout_unavailable:
    "Stripe checkout is temporarily unavailable. Please try again shortly.",
  paid_checkout_not_enabled:
    "Paid checkout is not currently open. You can keep using your free dashboard.",
  already_paid:
    "You already have paid access. Refresh your status below to connect Telegram.",
  telegram_link_required:
    "Verify the Telegram account you will use for your paid channels, then return here.",
  telegram_destination_unavailable:
    "Telegram verification is temporarily unavailable. Please retry; you do not need to pay again.",
  telegram_invite_unavailable:
    "We could not create your channel invitation. Please retry; you do not need to pay again.",
  payment_required:
    "A verified payment is required before joining the paid channel.",
  verification_notifications_only:
    "Owner verification access does not include paid-channel membership.",
};
async function request(path, body) {
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const data = await r.json();
  if (!r.ok || !data.ok)
    throw Error(
      errors[data.error] ||
        "We could not complete that step. Please try again.",
    );
  return data;
}
function priceLabel(offer) {
  if (!offer) return null;
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: offer.currency,
  }).format(offer.amount / 100);
  return `${price} / ${offer.interval_count === 1 ? offer.interval : offer.interval_count + " " + offer.interval + "s"}`;
}
export default function Billing({ offer, qaEnabled, initialProducts }) {
  const router = useRouter(),
    verified = useRef("");
  const [status, setStatus] = useState(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [connection, setConnection] = useState(null),
    [invites, setInvites] = useState({}),
    [selected, setSelected] = useState(initialProducts);
  const refresh = useCallback(async () => {
    const data = await request("/api/billing-status");
    setStatus(data);
    return data;
  }, []);
  const session =
    typeof router.query.session_id === "string" ? router.query.session_id : "";
  useEffect(() => {
    if (!session) refresh().catch((e) => setError(e.message));
  }, [refresh, session]);
  const verify = useCallback(async () => {
    setBusy("verify");
    setError("");
    setMessage("Confirming your payment with Stripe…");
    try {
      await request(
        qaEnabled ? "/api/stripe/qa-verify" : "/api/stripe/verify-success",
        { session_id: session },
      );
      await refresh();
      setMessage("Payment confirmed. Continue below to join your paid channels.");
    } catch (e) {
      await refresh().catch(() => {});
      setError(e.message);
      setMessage("");
    } finally {
      setBusy("");
    }
  }, [session, qaEnabled, refresh]);
  useEffect(() => {
    if (session && verified.current !== session) {
      verified.current = session;
      verify();
    }
  }, [session, verify]);
  async function action(name, fn) {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const paidProducts=status?.products||[];
  const purchaseProducts=selected.filter(p=>!paidProducts.includes(p));
  const selectedLabel=selected.map(p=>LABELS[p]).join(" + ");
  const paid = status?.paid === true,
    linked = status?.telegram_linked === true;
  useEffect(() => {
    if (!paid || linked || !connection) return;
    const check = () => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    };
    const timer = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [paid, linked, connection, refresh]);
  return (
    <main className="billing-shell">
      <Link className="record-link" href="/dashboard">
        ← Back to your dashboard
      </Link>
      <header className="billing-heading">
        <span className="eyebrow">YOUR NEXT STEP</span>
        <h1>
          {paid
            ? "Join your paid Telegram channels."
            : "From free research to real-time access."}
        </h1>
        <p>
          Your free dashboard is ready now. Upgrade through Stripe, then join
          the private channel for each purchased product: Sports for sports picks, Markets
          for market trades. Research only; alert frequency varies and returns are not
          guaranteed.
        </p>
        {!paid && offer && (
          <a className="button-primary billing-jump" href="#paid-plan">
            View {priceLabel(offer && {...offer,amount:offer.amount*Math.max(1,purchaseProducts.length)})} plan ↓
          </a>
        )}
      </header>
      <ol className="journey-steps" aria-label="Your access steps">
        <li data-complete="true">
          <span>1</span>
          <div>
            <b>Free dashboard</b>
            <small>Account confirmed · 30-minute minimum delay</small>
          </div>
        </li>
        <li data-complete={paid} aria-current={!paid ? "step" : undefined}>
          <span>2</span>
          <div>
            <b>Pay on Stripe</b>
            <small>
              {paid
                ? "Payment verified"
                : "Secure checkout · review before paying"}
            </small>
          </div>
        </li>
        <li aria-current={paid ? "step" : undefined}>
          <span>3</span>
          <div>
            <b>Join your paid channels</b>
            <small>
              {linked
                ? "Account verified · open your invitation"
                : "Verify your Telegram account, then join"}
            </small>
          </div>
        </li>
      </ol>
      {error && (
        <div className="error-message" role="alert">
          {error}{" "}
          <button
            className="record-link"
            disabled={Boolean(busy)}
            onClick={() =>
              action("refresh", async () => {
                await refresh();
                setMessage("Access status refreshed.");
              })
            }
          >
            Refresh access status
          </button>
        </div>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {router.query.checkout === "cancelled" && !paid && (
        <p className="billing-notice" role="status">
          Checkout was cancelled. Your free dashboard is still available. You
          can return to Stripe whenever you’re ready.
        </p>
      )}
      <div className="billing-grid">
        <section className="billing-card">
          <span className="status-pill">Included with your account</span>
          <h2>Keep exploring for free.</h2>
          <p className="billing-price">
            $0 <small>no card required</small>
          </p>
          <ul>
            <li>Sports and market paper research</li>
            <li>New records and updates after at least 30 minutes</li>
            <li>Captured prices, results and research context</li>
          </ul>
          <Link className="button-secondary" href="/dashboard">
            Open free dashboard
          </Link>
        </section>
        <section id="paid-plan" className="billing-card billing-paid">
          <span className="status-pill">
            {paid ? "Payment verified" : "Optional upgrade"}
          </span>
          <h2>Real-time + Telegram</h2>
          <fieldset><legend>Choose your products</legend>{['sports','markets'].map(product=><label key={product} style={{display:'block',margin:'0.5rem 0'}}><input type="checkbox" checked={selected.includes(product)} onChange={()=>setSelected(old=>old.includes(product)?old.filter(p=>p!==product):[...old,product])}/>{' '}{LABELS[product]}{paidProducts.includes(product)?' — already paid':''}</label>)}</fieldset>
          <p>{selectedLabel || 'Select at least one product.'} · Each product has the same subscription price. Both costs the sum.</p>
          {offer && <p className="billing-price">{priceLabel(offer && {...offer,amount:offer.amount*Math.max(1,purchaseProducts.length)})}</p>}
          <ul>
            <li>Real-time access to available paper research</li>
            <li>Sports in SharpsSignal | Sports; market trades in SharpsSignal | Markets</li>
            <li>One account for your dashboard and Telegram access</li>
          </ul>
          {paid && !purchaseProducts.length ? (
            <p className="success-message">
              Your paid access is active. Continue to step 3 below.
            </p>
          ) : offer ? (
            <>
              <p className="small muted">
                Recurring subscription. Renews every{" "}
                {offer.interval_count === 1
                  ? offer.interval
                  : offer.interval_count + " " + offer.interval + "s"}{" "}
                until cancelled. Stripe shows the final total before you pay.
              </p>
              <button
                className="button-primary full-width"
                disabled={Boolean(busy) || !status || !purchaseProducts.length}
                onClick={() =>
                  action("checkout", async () => {
                    await trackFunnelEvent("checkout_click");
                    try {
                      const d = await request(
                        "/api/stripe/create-checkout-session",
                        {
                          products: purchaseProducts,
                          visitor_id: getVisitorId(),
                          session_id: getSessionId(),
                          ...getFirstTouch(),
                        },
                      );
                      window.location.assign(d.url);
                    } catch (e) {
                      trackFunnelEvent("checkout_error");
                      throw e;
                    }
                  })
                }
              >
                {busy === "checkout"
                  ? "Opening Stripe…"
                  : !status
                    ? "Checking your access…"
                    : "Continue to secure Stripe checkout →"}
              </button>
            </>
          ) : (
            <p className="billing-notice">
              Checkout is temporarily unavailable. Your free dashboard remains
              available; please check back shortly.
            </p>
          )}
          {session && !paid && (
            <button
              className="button-secondary full-width"
              disabled={Boolean(busy)}
              onClick={verify}
            >
              {busy === "verify"
                ? "Confirming payment…"
                : "Check my completed payment"}
            </button>
          )}
        </section>
      </div>
      <section
        className="billing-card telegram-step"
        aria-labelledby="telegram-title"
      >
        <span className="eyebrow">STEP 3 · AFTER PAYMENT</span>
        <h2 id="telegram-title">Join your paid Telegram channels.</h2>
        <p>
          Sports subscribers join SharpsSignal | Sports. Markets subscribers join SharpsSignal | Markets.
          Subscribers to both receive an invitation to each channel.
        </p>
        {!paid ? (
          <p className="muted">
            Complete Stripe checkout first. Once your payment is verified, your
            personal paid-channel invitation will unlock here after a one-time
            Telegram account check.
          </p>
        ) : (
          <>
            {!linked ? (
              <>
                <p>
                  First, verify which Telegram account should receive your
                  paid-channel access.
                </p>
                <button
                  className="button-primary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    action("link", async () => {
                      setConnection(
                        await request("/api/telegram-link-code", {product:paidProducts[0]}),
                      );
                    })
                  }
                >
                  {busy === "link"
                    ? "Preparing account verification…"
                    : connection
                      ? "Restart account verification"
                      : "Verify your Telegram account →"}
                </button>
                {connection && (
                  <div className="telegram-command">
                    <h3>Verify your Telegram account</h3>
                    <p>
                      Open the verification assistant and tap <b>Start</b>, then
                      return here. This only links your account; your plays are
                      in the channel for each product you have paid for.
                    </p>
                    <a
                      className="button-primary"
                      href={connection.verification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Verify Telegram account ↗
                    </a>
                    <p className="small">
                      The verification link expires in 15 minutes. Your
                      paid-channel invitation appears here once your account is
                      linked.
                    </p>
                    <button
                      className="button-secondary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        action("check", async () => {
                          const s = await refresh();
                          setMessage(
                            s.telegram_linked
                              ? "Telegram verified. Open your paid-channel invitation below."
                              : "Not verified yet. Tap Start in the verification assistant, then return here.",
                          );
                        })
                      }
                    >
                      I tapped Start — check verification
                    </button>
                    <details>
                      <summary>Need to link manually?</summary>
                      <p>
                        Send this command to the same verification assistant:
                      </p>
                      <code>{connection.command}</code>
                      <button
                        className="button-secondary"
                        onClick={() =>
                          action("copy", async () => {
                            await navigator.clipboard.writeText(
                              connection.command,
                            );
                            setMessage("Verification command copied.");
                          })
                        }
                      >
                        Copy command
                      </button>
                    </details>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="success-message">
                  Your Telegram account is verified for paid-channel access.
                </p>
                {paidProducts.map(product=><div key={product} className="billing-notice">
                  <h3>{product==='sports'?'SharpsSignal | Sports':'SharpsSignal | Markets'}</h3>
                  <button className="button-primary" disabled={Boolean(busy)} onClick={()=>action('invite-'+product,async()=>{const d=await request('/api/telegram-invite',{product});setInvites(old=>({...old,[product]:d.url}));})}>{busy==='invite-'+product?'Creating invitation…':`Get my ${LABELS[product]} invitation`}</button>
                  {invites[product]&&<a className="button-secondary" href={invites[product]} target="_blank" rel="noopener noreferrer">Open {LABELS[product]} channel ↗</a>}
                  <p className="small">Personal invitations expire within 10 minutes. Your linked Telegram account and payment for this product are checked again when you request to join.</p>
                </div>)}
              </>
            )}
          </>
        )}
      </section>
      <p className="small muted">
        Billing help or cancellation requests:{" "}
        <a className="record-link" href="mailto:SharpsSignal@gmail.com">
          SharpsSignal@gmail.com
        </a>
        .
      </p>
      {qaEnabled && (
        <details className="research-guide">
          <summary>Owner verification tools</summary>
          <p>
            Labelled $1 verification only. No renewal and no paid-channel
            admission.
          </p>
          <button
            className="button-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              action("qa", async () => {
                const d = await request("/api/stripe/qa-checkout", {});
                window.location.assign(d.url);
              })
            }
          >
            Open $1 verification checkout
          </button>
        </details>
      )}
    </main>
  );
}
