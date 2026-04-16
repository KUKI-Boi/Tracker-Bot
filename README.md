# 🤖 Intern Tracker Slack Bot

A Slack bot that lets interns log their **Login** and **Logout** times via a simple slash command. All entries are written to a Google Sheet, and every night at **midnight** the bot posts a summary of total hours worked by each intern.

---

## How it works

1. An intern types `/update` anywhere in Slack
2. A modal pops up with a single dropdown — **🟢 Login** or **🔴 Logout**
3. On submit, a row is appended to the **Task Tracker** Google Sheet
4. The intern receives a DM confirmation with the recorded time
5. Every night at **12:00 AM IST**, the bot posts a ranked daily hours summary to a chosen channel

---

## Features

- `/update` slash command opens a clean Login / Logout modal
- Logs `Name`, `Slack User ID`, `Action`, and `Timestamp` to Google Sheets
- Sends interns a confirmation DM after each submission
- Calculates total hours worked per person from Login → Logout pairs
- Posts a ranked midnight summary to a configurable Slack channel
- Uses **Socket Mode** — no public URL or ngrok required

---

## Tech stack

| Layer | Technology |
|---|---|
| Bot framework | [Slack Bolt for Node.js](https://slack.dev/bolt-js) |
| Sheets integration | [Google Sheets API v4](https://developers.google.com/sheets/api) |
| Scheduling | [node-cron](https://github.com/node-cron/node-cron) |
| Hosting | [Railway](https://railway.app) |
| Runtime | Node.js 18+ |

---

## Project structure

```
intern-slack-bot/
├── app.js              # Main bot — slash command, modal, midnight scheduler
├── sheets.js           # Google Sheets read/write logic
├── package.json
├── .env                # Secrets (never commit this)
├── .gitignore
└── credentials.json    # Google service account key (never commit this)
```

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- A [Slack workspace](https://slack.com) where you can install apps
- A Google account with access to Google Cloud Console
- A [Railway](https://railway.app) account (free tier works)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/KUKI-Boi/Tracker-Bot.git
cd Tracker-Bot
npm install
```

### 2. Create your Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it `Intern Tracker Bot` and select your workspace
3. Under **Socket Mode** — **enable it** and generate an **App-Level Token** with `connections:write` scope. Copy the token (`xapp-...`)
4. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write`
   - `im:write`
   - `users:read`
   - `commands`
5. Click **Install to Workspace** — copy the **Bot User OAuth Token** (`xoxb-...`)
6. Go to **Basic Information** — copy the **Signing Secret**
7. Under **Slash Commands** → **Create New Command**:
   - Command: `/update`
   - Description: `Log your Login or Logout`
   - *(No Request URL needed — Socket Mode handles it)*

### 3. Set up Google Sheets API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a new project
2. Enable the **Google Sheets API**
3. Go to **IAM & Admin → Service Accounts** → create a service account
4. Click the account → **Keys** → **Add Key** → **JSON** → download and save as `credentials.json` in the project root
5. Open your Google Sheet → **Share** → paste the `client_email` from `credentials.json` → give it **Editor** access
6. Copy the Sheet ID from the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
7. Make sure the sheet tab is named exactly **`Task Tracker`**

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
SHEET_ID=your-google-sheet-id
SUMMARY_CHANNEL=#general
```

> ⚠️ Never commit `.env` or `credentials.json` to GitHub. Both are listed in `.gitignore`.

---

## Running locally

```bash
node app.js
```

Because the bot uses **Socket Mode**, no tunnelling (ngrok) is required — it connects out to Slack directly.

---

## Google Sheet format

The bot appends rows to a tab named **`Task Tracker`** with four columns:

| A | B | C | D |
|---|---|---|---|
| Name | Slack User ID | Action | Timestamp |

`Action` is either `Login` or `Logout`. Hours are calculated by pairing each Login with the next Logout for the same user.

---

## Midnight summary

Every night at **12:00 AM IST** the bot reads all Login/Logout rows for the current day, computes total hours per intern, and posts a ranked summary like this:

```
📊 Daily Time Summary — Wednesday, 16 April 2026

🥇 Riya Sharma — 7.5 hrs
🥈 Arjun Mehta — 6.25 hrs
🥉 Priya Nair — 5 hrs
```

The channel is set via the `SUMMARY_CHANNEL` environment variable (defaults to `#general`).

---

## Deploy to Railway

### 1. Push to GitHub

```bash
git add .
git commit -m "initial commit"
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select this repo
2. Railway auto-detects Node.js and runs `node app.js`

### 3. Add environment variables

In Railway: go to your project → **Variables** tab → add all five variables from your `.env` file.

For `credentials.json`, paste its entire contents as a variable named `GOOGLE_CREDENTIALS`, then update `sheets.js` to use:

```js
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
```

---

## Customisation

**Change the midnight summary time**

In `app.js`, update the cron expression (server runs in IST):

```js
// Midnight every day (default)
cron.schedule('0 0 * * *', async () => { ... }, { timezone: 'Asia/Kolkata' });

// 11:00 PM instead
cron.schedule('0 23 * * *', async () => { ... }, { timezone: 'Asia/Kolkata' });
```

**Change the summary channel**

Set `SUMMARY_CHANNEL` in your `.env` or Railway variables to any channel name, e.g. `#intern-updates`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `/update` command does nothing | Make sure Socket Mode is enabled and `SLACK_APP_TOKEN` (`xapp-...`) is set correctly |
| Modal submits but no row in Sheet | Check Railway logs for Sheets API errors. Verify the service account has Editor access and the tab is named `Task Tracker` |
| Hours show as 0 in summary | Each Login must have a matching Logout on the same day. Unpaired logins are excluded |
| `invalid_auth` error | Your `SLACK_BOT_TOKEN` is wrong or expired — reinstall the app in your workspace |
| Summary not posting | Confirm `SUMMARY_CHANNEL` matches a channel the bot has been invited to |
| Sheet tab not found | Tab name is case-sensitive — must be exactly `Task Tracker` |

---

## License

MIT — free to use and modify.

---

*Built for Verblyn Labs · Questions? Ping @KUKI-Boi*
