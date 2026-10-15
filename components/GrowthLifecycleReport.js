const count = (value) => (value == null ? "Unavailable" : value);
const status = (value) =>
  ({
    available: "Available",
    partial: "Partial — totals unavailable",
    unavailable: "Unavailable",
    not_configured: "Not configured",
  })[value] || "Unavailable";
function RetentionCell({ value, measurable }) {
  if (!measurable) return <>Not measured</>;
  return (
    <>
      {value.eligible
        ? `${value.returned} / ${value.eligible} (${((100 * value.returned) / value.eligible).toFixed(1)}%)`
        : "Pending"}
      {value.pending > 0 && (
        <small style={{ display: "block" }}>
          {value.pending} still maturing
        </small>
      )}
    </>
  );
}
export default function GrowthLifecycleReport({ data }) {
  if (!data)
    return <p role="status">Conversion and retention evidence unavailable.</p>;
  return (
    <>
      <h2>Verified membership conversions</h2>
      <p>
        Account evidence: {status(data.statuses.accounts)} · Activity evidence:{" "}
        {status(data.statuses.activity)}
      </p>
      <p>
        For accounts created in the selected window: account creation and email
        confirmation come from Supabase Auth. Browser submissions are attempts,
        not accounts. Each account is counted once, even when a page or click
        step was skipped.
      </p>
      <div className="feature-grid">
        {[
          [
            "Signup submitted",
            data.conversions.submitted,
            "consented browsers",
          ],
          ["Account created", data.conversions.created, "verified accounts"],
          ["Email confirmed", data.conversions.confirmed, "verified accounts"],
          [
            "First useful action",
            data.conversions.activated,
            "accounts viewing a released record",
          ],
        ].map(([label, value, unit]) => (
          <article className="feature-card" key={label}>
            <h3>{label}</h3>
            <strong>{count(value)}</strong>
            <p>{unit}</p>
          </article>
        ))}
      </div>
      <p>
        Activation means a released record was at least half visible for five
        continuous seconds in a visible tab, with analytics allowed and a
        server-verified member/record receipt. Opening an empty dashboard does
        not qualify. This observes viewing, not comprehension or betting.
      </p>
      <h2>Sources that lead to conversion</h2>
      <p>
        First-touch acquisition, split by source, medium, campaign and
        post/email tag (<code>utm_content</code>). Use a distinct tag for every
        X post and email. Tags are self-reported attribution, not proof of
        causation. Returning means a different record viewed at least 24 hours
        after the first.
      </p>
      <p>
        {count(data.conversions.attributed)} newly created accounts have a
        signup browser link. Missing campaign evidence stays unattributed; older
        accounts are not assigned to guessed campaigns.
      </p>
      <div className="story-table">
        <table>
          <thead>
            <tr>
              {[
                "Source / medium",
                "Campaign",
                "Post / email",
                "Visitors",
                "Accounts created",
                "Email confirmed",
                "Activated",
                "Returning",
                "Saved $5 interest",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((row, i) => (
              <tr key={i}>
                <td>
                  {row.source} / {row.medium}
                </td>
                <td>{row.campaign}</td>
                <td>{row.content}</td>
                {[
                  "visitors",
                  "created",
                  "confirmed",
                  "activated",
                  "returning",
                  "waitlist",
                ].map((key) => (
                  <td key={key}>{count(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.campaigns.length && (
        <p>No campaign observations in this window.</p>
      )}
      <h2>Signup-week retention</h2>
      <p>
        Weeks start Monday in America/New_York. Return within 7 or 30 days of
        signup requires a different released record viewed at least 24 hours
        after the first. These are cumulative return windows, not exact-day
        retention. Rates include only accounts with consented signup measurement
        whose full 7/30-day window has elapsed.
      </p>
      <p>
        Historical or unlinked accounts are shown in signup totals but excluded
        from retention denominators. Declined consent, blockers, consent changes
        and collection failures limit coverage. Pending windows are not
        failures.
      </p>
      {data.cohorts === null ? (
        <p>Account or activity evidence unavailable; retention is unknown.</p>
      ) : (
        <div className="story-table">
          <table>
            <thead>
              <tr>
                {[
                  "Signup week",
                  "Accounts",
                  "Measured at signup",
                  "Activated",
                  "Returned within 7 days",
                  "Returned within 30 days",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((row) => (
                <tr key={row.week}>
                  <td>{row.week}</td>
                  <td>{row.signups}</td>
                  <td>{row.measurable}</td>
                  <td>{row.activated}</td>
                  <td>
                    <RetentionCell value={row.d7} measurable={row.measurable} />
                  </td>
                  <td>
                    <RetentionCell
                      value={row.d30}
                      measurable={row.measurable}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.cohorts.length && <p>No accounts created in this window.</p>}
        </div>
      )}
      <h2>Separate offer funnels</h2>
      <p>
        Independent step totals; visitors can skip earlier steps. Browser
        counts, accounts, saved entries and paid checkouts have different units
        and should not be divided into a single conversion rate.
      </p>
      {data.offers.map((offer) => (
        <section className="member-panel" key={offer.key}>
          <h3>{offer.title}</h3>
          <p>Evidence: {status(offer.status)}</p>
          {offer.note && <p>{offer.note}</p>}
          {offer.steps.length > 0 && (
            <div className="story-table">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Count</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {offer.steps.map((step) => (
                    <tr key={step.label}>
                      <td>{step.label}</td>
                      <td>{count(step.value)}</td>
                      <td>{step.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
