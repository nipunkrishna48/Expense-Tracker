# Pocketwise — Student Expense Tracker

A responsive expense tracker for student life. Track spending, set a monthly budget, and sync your account across devices with Supabase.

## Open the app

The live app is [Pocketwise on GitHub Pages](https://nipunkrishna48.github.io/Expense-Tracker/). Cloud sign-in works from this HTTPS address. Opening `index.html` directly works in local-only mode.

## Connected Supabase project

The free Supabase project, database tables, row-level security policies, browser publishable key, and GitHub Pages deployment are configured. The schema in [`supabase/schema.sql`](./supabase/schema.sql) limits each signed-in student to their own expenses and budget. The project's Site URL is set to the live app URL.

Create an account in Pocketwise using your email and a password. Confirm your email if prompted, then sign in. Your expenses and monthly budget will sync across devices. If this browser already has local expenses, choose **Import local data** to merge them into your account; the local budget replaces the account budget. The local copy is kept.

## Enable Google sign-in

The app includes a **Continue with Google** button. To activate it for this Supabase project:

1. In [Google Cloud Console](https://console.cloud.google.com/), configure the OAuth consent screen and create an OAuth client ID with application type **Web application**.
2. Add `https://vgsscxxukhzsrwyeqmcc.supabase.co/auth/v1/callback` as an **Authorized redirect URI** in Google Cloud. This is Supabase's callback, not the GitHub Pages app URL.
3. In Supabase, open Authentication → Sign In / Providers → Google, enable Google, and enter the Google OAuth **Client ID** and **Client secret**. Save these secrets in Supabase only; never put them in `config.js` or other browser code.
4. In Supabase Authentication → URL Configuration, allow `https://nipunkrishna48.github.io/Expense-Tracker/` as a redirect URL. The project's Site URL is already set to this app.

Google sign-in remains unavailable until a Google Cloud OAuth client is created and its client ID and secret are added to the Supabase provider settings.

For a new Supabase project, run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor, set its URL and browser-safe **publishable** key in `config.js`, and set its Authentication Site URL to the deployed HTTPS app. Never put a `service_role` or secret key in browser code.

The Supabase browser SDK is loaded from jsDelivr, so the app needs an internet connection for cloud sign-in and sync. The local-only tracker works without the Supabase configuration.

## Features

- Add, search, filter, and delete expenses with a description, amount, category, and date.
- Review monthly totals, budget progress, weekly spending, and category summaries.
- Create an account and sign in with email and password.
- Sign in or create an account with Google after enabling its Supabase OAuth provider.
- Sync account-owned expenses and budget across browsers and devices.
- Import existing local expenses and budget after signing in.
- Store data locally on the device when signed out.

## Privacy and security

Signed-out data is stored in browser `localStorage`. Signed-in data is stored in your Supabase project; row-level security policies in `supabase/schema.sql` ensure each account can access only its own records. Clearing browser site data removes the local copy and the saved Supabase login session, but does not delete data in the Supabase account. The app currently formats amounts in Indian rupees.
