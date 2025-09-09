// pages/api/picks.js
import { google } from "googleapis";

const GSHEET_ID = process.env.GSHEET_ID;           // The Google Sheet ID
const OBS_TAB  = process.env.OBS_TAB || "AllObservations";
const BETS_TAB = process.env.BETS_TAB || "AllBets";

export default async function handler(req, res) {
  try {
    const source = (req.query.source || "").toLowerCase();
    const tab = source === "observations" ? OBS_TAB : BETS_TAB;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Read whole tab — assumes row 1 is headers
    const range = `${tab}!A:ZZ`;
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: GSHEET_ID,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const rows = data.values || [];
    if (rows.length < 2) return res.status(200).json({ picks: [] });

    const header = rows[0].map(h => (h || "").toString().trim());
    const out = rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i] ?? null; });
      return obj;
    });

    return res.status(200).json({ picks: out });
  } catch (err) {
    console.error("api/picks error:", err);
    return res.status(500).json({ error: "Failed to load picks" });
  }
}
