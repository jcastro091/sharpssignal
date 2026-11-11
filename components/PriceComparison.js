import { createContext, useContext, useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { decimalToAmericanLabel } from "../lib/oddsDisplay.cjs";
import { sportsbookName } from "../lib/sportsbookDisplay.cjs";
import { signalKey } from "../lib/signalChanges.cjs";
const { BOOKS, time, quoteState } = require("../lib/priceComparison.cjs");
const Context = createContext({ region: "", books: [], ready: false });
export function usePricePreferences() { return useContext(Context); }
export function PriceComparisonProvider({ children }) {
  const [prefs, setPrefs] = useState({ region: "", books: [], ready: false });
  const [now, setNow] = useState(Date.now());
  const syncClock = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ss_price_preferences") || "{}",
      );
      setPrefs({
        region: saved.region === "NY" ? "NY" : "",
        books: Array.isArray(saved.books)
          ? saved.books.filter((b) => Object.hasOwn(BOOKS, b))
          : [],
        defaultStake: Number(saved.defaultStake) > 0 && Number(saved.defaultStake) <= 100000 ? Number(saved.defaultStake).toFixed(2) : "10.00",
        ready: true,
      });
    } catch {
      setPrefs({ region: "", books: [], defaultStake: "10.00", ready: true });
    }
  }, []);
  function update(next) {
    next = { ...prefs, ...next };
    setPrefs({ ...next, ready: true });
    try {
      localStorage.setItem("ss_price_preferences", JSON.stringify(next));
    } catch {}
  }
  return (
    <Context.Provider value={{ defaultStake: "10.00", ...prefs, now, syncClock, update }}>{children}</Context.Provider>
  );
}
export function SportsbookPricePreferences() {
  const { region, books, defaultStake, update } = useContext(Context);
  const [stake, setStake] = useState(defaultStake);
  const [stakeSaved, setStakeSaved] = useState(false);
  useEffect(() => setStake(defaultStake), [defaultStake]);
  return (
    <section
      className="price-preferences"
      aria-label="Sportsbook price preferences"
    >
      <form onSubmit={event => { event.preventDefault(); update({ defaultStake: Number(stake).toFixed(2) }); setStakeSaved(true); }}>
        <label>Default stake ($)<input name="defaultStake" type="number" min="0.01" max="100000" step="0.01" required value={stake ?? "10.00"} onChange={event => { setStake(event.target.value); setStakeSaved(false); }}/></label>
        <button type="submit" className="button-secondary">Save default stake</button>
        <p className="small muted" role="status">{stakeSaved ? "Default stake saved. " : ""}Used for every new tail. You can change each play’s stake. Saved in this browser.</p>
      </form>
      <details>
        <summary>Choose your sportsbooks for price comparisons</summary>
        <p>
          Choose where you are betting and the accounts you can use. Saved only
          in this browser. We do not verify your account eligibility or
          guarantee an executable price.
        </p>
        <label>
          Betting location
          <select
            value={region}
            onChange={(e) => update({ region: e.target.value, books: [] })}
          >
            <option value="">Choose your location</option>
            <option value="NY">New York</option>
            <option value="unsupported">
              Another location — comparison unavailable
            </option>
          </select>
        </label>
        {region === "NY" && (
          <fieldset>
            <legend>Your sportsbooks · NY comparison coverage</legend>
            {Object.entries(BOOKS).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={books.includes(key)}
                  onChange={(e) =>
                    update({
                      region,
                      books: e.target.checked
                        ? [...books, key]
                        : books.filter((b) => b !== key),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <p className="small muted">
          Coverage is limited to these four sportsbooks and provider-reported
          prices. Ages 21+. Check the{" "}
          <a
            href="https://gaming.ny.gov/sports-wagering"
            target="_blank"
            rel="noreferrer"
          >
            NY Gaming Commission’s current operator list
          </a>{" "}
          and your sportsbook’s rules.
        </p>
      </details>
    </section>
  );
}
function Stamp({ value }) {
  const t = time(value);
  if (!Number.isFinite(t)) return <span>Timestamp unavailable</span>;
  return (
    <time dateTime={new Date(t).toISOString()}>
      {new Date(t).toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })}{" "}
      ET
    </time>
  );
}
async function fetchPrices(url) {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error("Prices unavailable. Please try again shortly.");
  return result;
}
export function usePriceComparison(play, enabled = true) {
  const { region, books, ready, syncClock, now = Date.now() } = useContext(Context);
  const pick = signalKey(play), bookKey = [...books].sort().join(",");
  const closed = quoteState(play, null, now).status === "closed";
  const key = enabled && ready && region === "NY" && bookKey && !closed
    ? "/api/price-comparison?" + new URLSearchParams({ pick, books: bookKey, region }) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetchPrices, {
    onSuccess: syncClock,
    refreshInterval: 60000, dedupingInterval: 5000, revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  return { region, books, data, error: error?.message || "", loading: isLoading || isValidating,
    view: quoteState(play, key ? data : null, now), refresh: () => mutate() };
}
export default function PriceComparison({ play }) {
  const { region, books, data, error, loading, view, refresh } = usePriceComparison(play);
  return (
    <div className="price-comparison">
      <p>
        <strong>Original signal:</strong> {decimalToAmericanLabel(play.decimal)}{" "}
        · {sportsbookName(play.book)}
        <br />
        <small>
          Captured <Stamp value={play.entry_at ?? play.recorded_at} />
        </small>
      </p>
      {view.status === "closed" ? (
        <p className="price-closed">Pregame market closed.</p>
      ) : region !== "NY" || !books.length ? (
        <p className="small muted">
          Choose your location and sportsbooks above to compare prices.
        </p>
      ) : (
        <>
          {loading ? (
            <p role="status">Checking selected sportsbooks…</p>
          ) : error ? (
            <p role="status">{error}</p>
          ) : view.best ? (
            <p className="best-price">
              <strong>
                Best observed: {decimalToAmericanLabel(view.best.decimal)} ·{" "}
                {view.best.name}
              </strong>
              <br />
              <small>
                Quote <Stamp value={view.best.observed_at} />
              </small>
            </p>
          ) : (
            <p role="status">
              {view.status === "stale"
                ? "Quotes are stale — refresh before using them."
                : "Current matching prices unavailable."}
            </p>
          )}
          <details>
            <summary>Compare selected sportsbooks</summary>
            <p className="small muted">
              Same event, selection and line. Best observed among your selected
              sportsbooks; not a guaranteed fill.
            </p>
            <div className="price-table">
              <table>
                <thead>
                  <tr>
                    <th>Sportsbook</th>
                    <th>Odds</th>
                    <th>Quote time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(view.quotes.length
                    ? view.quotes
                    : books.map((book) => ({
                        book,
                        name: BOOKS[book],
                        status: "unavailable",
                      }))
                  ).map((q) => (
                    <tr key={q.book}>
                      <td>{q.name}</td>
                      <td>
                        {q.decimal ? decimalToAmericanLabel(q.decimal) : "—"}
                      </td>
                      <td>
                        <Stamp value={q.observed_at} />
                      </td>
                      <td>
                        {q.status === "current"
                          ? "Recent"
                          : q.status === "stale"
                            ? "Stale"
                            : "Unavailable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.checked_at && (
              <p className="small muted">
                Provider checked <Stamp value={data.checked_at} />
              </p>
            )}
          </details>
          <button
            type="button"
            className="price-refresh"
            disabled={loading}
            onClick={() => {
              refresh();
            }}
          >
            Refresh prices
          </button>
        </>
      )}
    </div>
  );
}
