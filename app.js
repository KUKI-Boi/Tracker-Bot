require('dotenv').config();
const { App } = require('@slack/bolt');
const cron = require('node-cron');
const { appendRow, getDailySummary } = require('./sheets');

// ─── Config ───────────────────────────────────────────────────────────────────
// The channel where the daily summary is posted (e.g. "#daily-summary")
const SUMMARY_CHANNEL = process.env.SUMMARY_CHANNEL || '#general';

// ─── Bolt app ─────────────────────────────────────────────────────────────────
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
});

// ─── /update  →  open the Login / Logout modal ────────────────────────────────
app.command('/update', async ({ command, ack, client }) => {
    await ack();

    await client.views.open({
        trigger_id: command.trigger_id,
        view: {
            type: 'modal',
            callback_id: 'update_modal',
            private_metadata: command.user_id,   // carry the Slack user ID through
            title: { type: 'plain_text', text: 'Log your time' },
            submit: { type: 'plain_text', text: 'Submit' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
                {
                    type: 'input', block_id: 'action',
                    label: { type: 'plain_text', text: 'Action' },
                    element: {
                        type: 'static_select',
                        action_id: 'value',
                        placeholder: { type: 'plain_text', text: 'Select an action' },
                        options: [
                            { text: { type: 'plain_text', text: '🟢 Login' }, value: 'Login' },
                            { text: { type: 'plain_text', text: '🔴 Logout' }, value: 'Logout' },
                        ],
                    },
                },
            ],
        },
    });
});

// ─── Modal submission ─────────────────────────────────────────────────────────
app.view('update_modal', async ({ ack, view, client }) => {
    await ack();

    const userId = view.private_metadata;
    const action = view.state.values.action.value.selected_option.value; // 'Login' | 'Logout'
    const timestamp = new Date().toISOString();

    // Resolve the user's display name from Slack
    let name = userId;
    try {
        const info = await client.users.info({ user: userId });
        name = info.user.real_name || info.user.name;
    } catch (_) { /* fall back to userId if lookup fails */ }

    // Write to Google Sheets
    await appendRow(name, userId, action, timestamp);

    // Confirm to the user via DM
    const emoji = action === 'Login' ? '🟢' : '🔴';
    await client.chat.postMessage({
        channel: userId,
        text: `${emoji} *${action}* recorded at <!date^${Math.floor(Date.now() / 1000)}^{time}|${timestamp}>. It's been logged to the sheet!`,
    });
});

// ─── Daily midnight summary (IST = UTC+5:30 → UTC 18:30 prev. day) ───────────
// Cron format: minute hour * * *   (server local time)
// If server runs in IST, use '0 0 * * *'
// If server runs in UTC, use '30 18 * * *'
cron.schedule('0 0 * * *', async () => {
    try {
        const summary = await getDailySummary();

        if (!summary || summary.length === 0) {
            await app.client.chat.postMessage({
                channel: SUMMARY_CHANNEL,
                text: '📋 *Daily Time Summary* — No hours logged today.',
            });
            return;
        }

        // Build a ranked leaderboard-style message
        const lines = summary
            .sort((a, b) => b.totalHours - a.totalHours)
            .map((s, i) => {
                const medal = ['🥇', '🥈', '🥉'][i] || '▪️';
                const hrs = s.totalHours;
                const hLabel = hrs === 1 ? 'hr' : 'hrs';
                return `${medal} *${s.name}* — ${hrs} ${hLabel}`;
            })
            .join('\n');

        const today = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        await app.client.chat.postMessage({
            channel: SUMMARY_CHANNEL,
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: `📊 Daily Time Summary — ${today}` },
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: lines },
                },
                {
                    type: 'context',
                    elements: [{ type: 'mrkdwn', text: 'Logged hours are calculated from Login → Logout pairs.' }],
                },
            ],
        });
    } catch (err) {
        console.error('Daily summary error:', err);
    }
}, {
    timezone: 'Asia/Kolkata',   // remove this line if your server is already in IST
});

// ─── Start ────────────────────────────────────────────────────────────────────
(async () => {
    await app.start();
    console.log('⚡️ Slack bot is running');
})();