# Outreach platform

A small web app for the outreach team. It works with LeadFinder, but it is separate:

- **LeadFinder** runs on your computer. It finds and checks businesses, then exports a CSV.
- **This app** can run online. The team imports that CSV, picks businesses to contact, and tracks who responds.

Data is stored in **Supabase** (a hosted Postgres database). Logins come from the settings file, so there are no user accounts to manage.

## How it works

Three tables, one list of leads behind them:

| Table | What it shows |
|---|---|
| **Leads** | Every imported business (only websites that work). Tick the ones to contact. |
| **Outreach** | The ticked businesses. Change the stage: First outreach, Follow-up 1, Follow-up 2, Responded, No response. |
| **Prospects** | Businesses set to **Responded**. |

- **Leads screen:** switch between *To pick*, *In outreach* and *All*. A panel on the right, **Your outreach list**, fills as you tick. Shift-click ticks a range. Every tick has **Undo**.
- **Outreach screen:** a strip at the top counts each stage and shows how many are **due** (waiting 3 days or more). Each row has one-click buttons: move to the next stage, or **Responded**.
- **Click any business** to open its side panel: stage, contact details, the LeadFinder pitch (Copy button), notes that save by themselves, and the history of who moved it and when.
- Changes by teammates appear within about 20 seconds. Your own changes show at once.
- Press `/` to jump to search. Works on a phone too.
- **Delete:** on the Leads screen press **Delete…**, tick the businesses to remove, then press **Delete**. On Outreach and Prospects each row has a trash button, and every side panel has **Delete this business**. Deleting asks first, removes the business and its history for good, and cannot be undone.
- **Phone and tablet:** below 900px wide the tables become cards with large tap targets, a bottom tab bar, and an account menu (top right) with Sign out.

## Set up Supabase (about 5 minutes)

1. In your Supabase project open **SQL Editor → New query**. Paste everything from [supabase/schema.sql](supabase/schema.sql) and click **Run**. This creates the `leads` and `events` tables.
2. Click **Connect** at the top of the project. Under **Connection string** choose **Transaction pooler**. Copy the link (it uses port **6543**).
3. In that link, replace `[YOUR-PASSWORD]` with your database password. This is `DATABASE_URL`.

**Why the Transaction pooler?** Vercel runs many short-lived functions. The Transaction pooler shares a few real connections between them. The Direct link only works over IPv6 (Vercel cannot use it), and the Session pooler is for servers that stay on.

If the password has special characters such as `@` or `#`, change it to letters and numbers in Supabase (**Project Settings → Database**), or the link will break.

## Set up the app

Copy `.env.example` to `.env.local` and fill in three things:

| Setting | What to put |
|---|---|
| `TEAM_LOGINS` | The people who may sign in: `email:password` pairs separated by commas. No commas inside a password. |
| `SESSION_SECRET` | Long random text. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | The Transaction pooler link from above, with your password in it. |

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

## Put it online (Vercel)

1. Push this repo to GitHub.
2. In Vercel choose **Add New → Project**, pick the repo, and set **Root Directory** to `outreach`.
3. Add the same three settings under **Environment Variables**.
4. Deploy.

To add or remove a person, change `TEAM_LOGINS` in Vercel and redeploy. Changing a password signs nobody out, but changing `SESSION_SECRET` signs everyone out.

## Each week
1. Run a search in LeadFinder and click **Export all**.
2. In this app, click **Import leads** and choose the CSV.
3. Businesses already stored are skipped, so importing the same file twice is safe.

## Good to know
- **Keep `DATABASE_URL` private.** It gives full access to the data. It is only used on the server, never sent to the browser. Never commit `.env.local` (it is in `.gitignore`).
- **No public access:** row level security is on for both tables with no rules, so Supabase's public API cannot read them. Only this app's server link can.
- **Passwords** in `TEAM_LOGINS` sit in plain text in the settings. That is fine for a small private team, but do not reuse a password from elsewhere.
- **About 5 wrong passwords** from one address block sign-in for 10 minutes.
- **The data** contains business contact details. Keep the CSV files off GitHub (they are in `.gitignore`), and honour opt-outs: if a business asks not to be contacted, set it to **No response** and add a note.

## Tests
```bash
npm test
```
Checks the import rules, the login and cookie, the input checks, and the stage-change rules. These do not need a database.

## Design
Light only. One raspberry colour: the strong shade only on small marks (buttons, checkboxes, the logo), pale tints for areas. The stages climb that one colour from pale to strong, and Responded is green. Font: DM Sans. The "due after 3 days" rule is `FOLLOW_UP_AFTER_DAYS` in `lib/leads.js`.

## Not built yet
- Per-person assignment ("this one is Ada's")
- Reminders and message templates
- A results dashboard
- A shared do-not-contact list
