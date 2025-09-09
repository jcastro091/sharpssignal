import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const serviceAccountBuffer = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64');
    const credentials = JSON.parse(serviceAccountBuffer.toString('utf8'));

    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    await jwtClient.authorize();

    const sheets = google.sheets({ version: 'v4', auth: jwtClient });
    const spreadsheetId = process.env.GSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `ConfirmedTrades2!A1:Z1000`,
    });

    const [headers, ...rows] = response.data.values || [];
    const trades = rows.map(row => {
      const trade = {};
      headers.forEach((header, i) => {
        trade[header] = row[i] || '';
      });
      return trade;
    });

    console.log(`✅ Loaded ${trades.length} trades`);
    return res.status(200).json({ trades });
  } catch (err) {
    console.error('❌ Error fetching trades:', err.message || err);
    return res.status(500).json({ error: 'Failed to load trades' });
  }
}
