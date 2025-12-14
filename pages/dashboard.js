// pages/picks.js
import PicksTable from "../components/PicksTable"
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs"
import { GoogleAuth } from "google-auth-library"
import { google } from "googleapis"

export default function PicksPage({ picks }) {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Your Confirmed Picks</h1>
      <PicksTable picks={picks} />
    </div>
  )
}

export const getServerSideProps = async (ctx) => {
  // 1) Auth guard
  const supabase = createServerSupabaseClient({ req: ctx.req, res: ctx.res })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return {
      redirect: {
        destination: `/signin?redirectTo=/picks`,
        permanent: false,
      },
    }
  }

  // 2) Pull sheet ID from your URL
  const raw = process.env.SPREADSHEET_URL
  const match = raw.match(/\/d\/([^\/]+)/)
  if (!match) throw new Error("Invalid SPREADSHEET_URL")
  const spreadsheetId = match[1]

  // 3) Authorize and fetch the **AllBets** tab
  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
  const client = await auth.getClient()
  const sheets = google.sheets({ version: "v4", auth: client })
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "AllBets!A:Z",      // widen if you have more columns
  })

  // 4) Map rows → objects
  const [header = [], ...rows] = data.values || []
  let picks = rows.map((row) =>
    Object.fromEntries(row.map((cell, i) => [header[i], cell]))
  )

  // 5) Filter to only those with an “Odds Taken” value
  picks = picks.filter(
    (p) =>
      p["Odds Taken"] !== undefined &&
      p["Odds Taken"] !== null &&
      String(p["Odds Taken"]).trim() !== ""
  )

  return { props: { picks } }
}
