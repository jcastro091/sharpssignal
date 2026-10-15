import { withAuthTimeout } from "./authWait";
const { token } = require("./measurement.cjs");
// Read server-owned auth facts; user metadata is only a self-reported acquisition label.
// No emails or raw account records are returned by the report API.
export async function readGrowthEvidence(db, since) {
  const evidence = {
    accounts: [],
    waitlist: [],
    statuses: { accounts: "unavailable", waitlist: "unavailable" },
  };
  try {
    let complete = false;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await withAuthTimeout(
        () => db.auth.admin.listUsers({ page, perPage: 500 }),
        8000,
      );
      if (error || !Array.isArray(data?.users)) throw Error();
      for (const user of data.users) {
        const raw = user.user_metadata?.growth_acquisition;
        evidence.accounts.push({
          id: user.id,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
          qa_test:
            user.id === process.env.QA_CHECKOUT_USER_ID ||
            user.app_metadata?.qa_test === true ||
            /@example\.invalid$/i.test(user.email || ""),
          acquisition:
            raw?.version === "2026-10-15-v2"
              ? {
                  version: raw.version,
                  visitor_id: /^v_[a-z0-9_-]{10,100}$/i.test(
                    raw.visitor_id || "",
                  )
                    ? raw.visitor_id
                    : null,
                  ...Object.fromEntries(
                    [
                      "utm_source",
                      "utm_medium",
                      "utm_campaign",
                      "utm_content",
                    ].map((k) => [k, token(raw[k])]),
                  ),
                }
              : null,
        });
      }
      if (data.users.length < 500) {
        complete = true;
        break;
      }
    }
    evidence.statuses.accounts = complete ? "available" : "partial";
  } catch {
    evidence.accounts = [];
  }
  try {
    let complete = false;
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await db
        .from("pick_waitlist")
        .select("created_at,utm_source,utm_medium,utm_campaign,utm_content")
        .gte("created_at", since)
        .order("created_at")
        .order("email")
        .range(offset, offset + 499)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw Error();
      evidence.waitlist.push(...data);
      if (data.length < 500) {
        complete = true;
        break;
      }
    }
    evidence.statuses.waitlist = complete ? "available" : "partial";
  } catch {
    evidence.waitlist = [];
  }
  return evidence;
}
