# StudyGroup — Virtual Study Room

Real-time study rooms for students: a shared Pomodoro timer, group chat, whiteboard, group tests, video calls, watch parties and personal progress tracking.

## Run locally

```bash
# first time only: install everything
npm run setup

# every time: starts the server (http://localhost:3001) and the website (http://localhost:5173) together
npm run dev
```

Open http://localhost:5173. Stop both with `Ctrl + C`.

If the app shows **“Can't reach StudyGroup”**, the server isn't running — start it with `npm run dev` from this folder. If the server says the port is already in use, an old server is still running in another terminal; close that one first.

## Server environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port (default `3001`) |
| `ANTHROPIC_API_KEY` | Turns on the AI Tutor (`/ask <question>` in chat). Without it the tutor is disabled. |
| `ADMIN_KEY` | Enables the admin overview at `GET /api/admin?key=<ADMIN_KEY>` and manual Pro grants (`POST /api/admin/grant-pro` with header `x-admin-key`, body `{"email", "days"}`). |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Turn on Pro payments (Razorpay Checkout: UPI, cards, netbanking). |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies the `order.paid` webhook at `/api/billing/webhook`, so Pro activates even if the buyer closes the tab mid-payment. |
| `PRO_PRICE_MONTHLY` / `PRO_PRICE_YEARLY` | Prices in ₹ (default 149 / 1199). |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Turn on video calls (LiveKit Cloud or a self-hosted LiveKit server, e.g. `wss://your-project.livekit.cloud`). |
| `DATA_DIR` | Where room data is saved (default `server/data`). |
| `CLIENT_ORIGIN` | Allowed origin(s), comma separated, when the frontend is hosted on another domain. |

Client: build with `VITE_SERVER_URL=https://your-server` if the frontend is hosted separately.

## Production

```bash
cd client && npm run build
cd ../server && npm start   # serves client/dist and the socket server on PORT
```

## Features

**Rooms** — create / join by code or invite link, public room list, password-protected private rooms, host controls (remove member, make host, host-only timer), room name & emoji, exam countdown, daily session time with Google Calendar link, weekly group challenge. Rooms are saved to disk and survive restarts; empty rooms are deleted after 7 days.

**Focus** — shared room timer (focus → short break → long break cycle, configurable), solo timer and a full-length mock-test mode, subject tagging, daily planner that picks the subject automatically, break activity ideas, chime + browser notifications, focus score (tab switches), live member status (Focusing / On Break / Idle / Away + subject), "got distracted" alerts.

**Together** — chat with replies, reactions, pins, polls, @mentions, LaTeX formulas (`$E=mc^2$`), links, typing indicator, unread badge; AI Tutor; hand-raise doubt queue; nudges; shared scratchpad with math preview; live whiteboard; YouTube watch party in sync; shared resource links; leaderboard; profanity filter; block & report.

**Group tests** — make a test from your notes (paste text, upload a PDF or a photo of handwritten notes), from any topic (AI, needs `ANTHROPIC_API_KEY`), or write the questions yourself; review/edit every question, set the time limit, start time (now / in N min / at a time) and marking (+1/0 or JEE +4/−1), then send it to the room. It opens on everyone's screen at the start time, answers save as you go, it auto-submits when time is up (or ends early once everyone has submitted), and then shows a leaderboard plus every answer with explanations. Questions stay hidden until the start and answers until the end.

**StudyGroup Pro** — optional email + password login; Pro is a one-time Razorpay payment (₹149/month or ₹1,199/year, adds time, no auto-renew), verified on the server by signature and by the `order.paid` webhook. Free plan: 1 AI test, 3 AI Tutor questions and 1 group test per day, basic stats, one accent + pastel/plain backgrounds, lofi + rain. Pro unlocks 5 AI tests and 30 AI Tutor questions per day, unlimited group tests (fair-use cap 50/day), full insights and recap cards, all themes and ambient sounds, private password rooms and a Pro badge. Limits are enforced by the server. In the Android app, Pro is bought on the website (Google Play rules) and unlocks via the same login.

**Video calls & classes** — LiveKit-based calls that scale to 10-15+ people (tuition classes): camera, mic, screen share (desktop browsers), a floating call window or full-screen gallery, spotlight on the shared screen or the teacher. Teacher (host) controls: lecture mode (only the teacher talks; students raise ✋), allow a student to speak, mute everyone — enforced by LiveKit permissions, not just the UI.

**Shared notes** — your notebook is private; “share with squad” sends a copy of a page to the room (chat card + shared list) that others can read and save to their own notebook.

**Progress** (stored in the browser) — daily goal ring, growing plant that wilts when you leave mid-session, XP & levels, 13 badges, streaks, heatmap calendar, weekly report, best focus hour, subject breakdown, session history with notes, shareable recap image, syllabus tracker (JEE / NEET / Class 10 & 12) with spaced-repetition revision reminders, personal formula bank.

**Experience** — Gen-Z light-first design (sticker-style cards, pastel dot-grid; dark theme optional), sticky-note goals, plain white whiteboard, private notebook drawer with a draggable button, 6 accent colours, background scenes, ambient sound mixer (rain, ocean, fireplace, wind, white & brown noise) + lofi stream, keyboard shortcuts (`?`), onboarding tour, mobile bottom tabs, installable PWA.

## Android app (APK)

The Android app is the same React code wrapped with Capacitor (`client/android`).

**One-time setup**

1. Install [Android Studio](https://developer.android.com/studio) and open it once so it downloads the Android SDK (it also brings the Java it needs).
2. The app runs from files on the phone, so it needs your server address. Create `client/.env`:
   - Testing on the same Wi-Fi: `VITE_SERVER_URL=http://<your-PC-IP>:3001` (find the IP with `ipconfig`, and allow Node through Windows Firewall).
   - Real use: deploy the server and use its https URL.

**Build**

```bash
cd client
npm run android:sync   # build the web app and copy it into the Android project
npm run android:open   # opens Android Studio → Build ▸ Build APK(s)
# or, from the command line once the SDK is installed:
npm run android:apk    # APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Run `npm run android:sync` again after every code change.

**What the app adds over the website:** timer-end notifications scheduled with Android (they arrive even when the app is in the background), the screen stays on during focus sessions, the status bar follows the theme, and the back button closes dialogs first.

**Before publishing on the Play Store:** use an https server, then set `"cleartext": false` and `"allowMixedContent": false` in `client/capacitor.config.json` (they are on only so you can test against a local http server), and build a signed release bundle from Android Studio (Build ▸ Generate Signed App Bundle).

## Notes

- Personal stats, planner, syllabus and formulas live in the browser's localStorage — they don't sync across devices (that needs accounts/login).
- `server/store.js` writes a JSON file. Replace it with a database (MongoDB / Postgres) for larger deployments.
