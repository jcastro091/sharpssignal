import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const keyPath = path.join(process.cwd(), 'telegrambetlogger-9533fe12f488.json');
    const keyFile = fs.readFileSync(keyPath, 'utf8');
    const credentials = JSON.parse(keyFile);
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    await jwtClient.authorize();

    const sheets = google.sheets({ version: 'v4', auth: jwtClient });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1000`,
    });

    const [headers, ...rows] = response.data.values || [];
    const picks = rows.map(row => {
      const pick = {};
      headers.forEach((header, i) => {
        pick[header] = row[i] || '';
      });
      return pick;
    });

    console.log(`✅ Loaded ${picks.length} picks`);
    return res.status(200).json({ picks });
  } catch (err) {
    console.error('❌ Error fetching picks:', err.message || err);
    return res.status(500).json({ error: 'Failed to load picks' });
  }
}
