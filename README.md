# Pocketwise — Student Expense Tracker

A responsive expense tracker for student life. Track spending, set a monthly budget, and sync your account across devices with Supabase.

## Open the app

The live app is [Pocketwise on GitHub Pages](https://nipunkrishna48.github.io/Expense-Tracker/). Cloud sign-in works from this HTTPS address. Opening `index.html` directly works in local-only mode.

## Connected Supabase project

The free Supabase project, database tables, row-level security policies, browser publishable key, and GitHub Pages deployment are configured. The schema in [`supabase/schema.sql`](./supabase/schema.sql) limits each signed-in student to their own expenses and budget. The project's Site URL is set to the live app URL.

Create an account in Pocketwise using your email and a password. Confirm your email if prompted, then sign in. Your expenses and monthly budget will sync across devices. If this browser already has local expenses, choose **Import local data** to merge them into your account; the local budget replaces the account budget. The local copy is kept.

For a new Supabase project, run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor, set its URL and browser-safe **publishable** key in `config.js`, and set its Authentication Site URL to the deployed HTTPS app. Never put a `service_role` or secret key in browser code.

The Supabase browser SDK is loaded from jsDelivr, so the app needs an internet connection for cloud sign-in and sync. The local-only tracker works without the Supabase configuration.

## Features

- Add, search, filter, and delete expenses with a description, amount, category, and date.
- Review monthly totals, budget progress, weekly spending, and category summaries.
- Create an account and sign in with email and password.
- Sync account-owned expenses and budget across browsers and devices.
- Import existing local expenses and budget after signing in.
- Store data locally on the device when signed out.

## Privacy and security

Signed-out data is stored in browser `localStorage`. Signed-in data is stored in your Supabase project; row-level security policies in `supabase/schema.sql` ensure each account can access only its own records. Clearing browser site data removes the local copy and the saved Supabase login session, but does not delete data in the Supabase account. The app currently formats amounts in Indian rupees.
