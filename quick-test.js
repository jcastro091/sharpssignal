// quick-test.js
import { GoogleAuth } from "google-auth-library";
import { google }      from "googleapis";

async function test() {
  const auth = new GoogleAuth({
    keyFile: "./telegrambetlogger-9533fe12f488.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();

  // double-check the service-account we’re using:
  console.log("Using service-account:", client.email);

  const sheets = google.sheets({ version: "v4", auth: client });
  const res = await sheets.spreadsheets.get({
    spreadsheetId: "1VI9ceOFI5LSqXuVoGGUE3h4JZ685oZFrbbPlDnGsGo",
  });
  console.log("✅ Got sheet title:", res.data.properties.title);
}

test().catch(err => {
  console.error("🔥 FAILED:", err.response?.data || err.message);
  process.exit(1);
});
