// pages/api/picks.js
import { google } from 'googleapis'
import { getSession } from 'next-auth/react'

export default async function handler(req, res) {
  // 1) Auth check
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  // 2) Parse SA key once
  let saKey
  try {
    saKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  } catch (err) {
    console.error('🔑 Key parse error:', err)
    return res.status(500).json({ error: 'Invalid SA key JSON' })
  }

  // 3) Build & force-authorize the JWT client
  const jwt = new google.auth.JWT(
    saKey.client_email,
    undefined,
    saKey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  )
  try {
    await jwt.authorize()
    console.log('✅ JWT authorized for', saKey.client_email)
  } catch (err) {
    console.error('❌ JWT auth error:', err)
    return res.status(500).json({ error: 'Service account auth failed' })
  }

  // 4) Fire off the Sheets call
  const sheets = google.sheets({ version: 'v4', auth: jwt })
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_URL,
      range: 'ConfirmedBets!A:F',
    })
    const rows = resp.data.values || []
    if (rows.length < 2) return res.status(200).json({ picks: [] })

    const [header, ...data] = rows
    const picks = data.map(r =>
      header.reduce((o, col, i) => {
        o[col] = r[i] || ''
        return o
      }, {})
    )
    return res.status(200).json({ picks })
  } catch (err) {
    // dump the full error so you can see response.data
    console.error('🛑 Sheets fetch error:', {
      code: err.code,
      response: err.response && err.response.data,
    })
    return res.status(500).json({ error: 'Failed to fetch from Sheets' })
  }
}
