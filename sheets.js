const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;          // Set in .env
const TAB_NAME = 'Task Tracker';                // Must match the sheet tab name

// Authenticate using the service-account credentials file
function getAuth() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

/**
 * Appends a single row: [Name, Slack User ID, Action, Timestamp]
 */
async function appendRow(name, userId, action, timestamp) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[name, userId, action, timestamp]],
    },
  });
}

/**
 * Reads all rows for today, groups Login/Logout pairs per user,
 * and returns an array of { userId, name, totalHours } objects.
 */
async function getDailySummary() {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A:D`,   // Name | UserID | Action | Timestamp
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return [];

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Filter only today's rows (skip header if present)
  const todayRows = rows.filter((r, i) => {
    if (i === 0 && r[0] === 'Name') return false; // skip header
    const ts = r[3];
    return ts && ts.startsWith(todayStr);
  });

  // Group by userId
  const userMap = {}; // userId → { name, sessions: [{ login, logout }], openLogin }
  for (const [name, userId, action, timestamp] of todayRows) {
    if (!userMap[userId]) {
      userMap[userId] = { name, sessions: [], openLogin: null };
    }
    const entry = userMap[userId];
    if (action === 'Login') {
      entry.openLogin = new Date(timestamp);
    } else if (action === 'Logout' && entry.openLogin) {
      const hrs = (new Date(timestamp) - entry.openLogin) / (1000 * 60 * 60);
      entry.sessions.push(hrs);
      entry.openLogin = null;
    }
  }

  // Build summary array
  const summary = [];
  for (const [userId, data] of Object.entries(userMap)) {
    const total = data.sessions.reduce((a, b) => a + b, 0);
    summary.push({ userId, name: data.name, totalHours: Math.round(total * 100) / 100 });
  }

  return summary;
}

module.exports = { appendRow, getDailySummary };
