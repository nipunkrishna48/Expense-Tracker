# Pocketwise — Student Expense Tracker

A responsive expense tracker for student life. Track spending, set a monthly budget, and optionally sync your account across devices with Supabase.

## Run it locally

Open `index.html` in a modern browser. The app works without a Supabase project and stores data in that browser on that device. Cloud sign-in requires the setup below and serving the site from an HTTP(S) address; use GitHub Pages or another static web host rather than opening the file directly.

## Set up cloud accounts and storage

1. Create a project at [supabase.com](https://supabase.com/).
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates the expenses and budget tables, enables row-level security (RLS), and limits authenticated users to their own records. (This has already been run for the connected project.)
3. `config.js` is already set up with the connected project's URL and **publishable** key. The publishable key is designed for browser use. Never add a `service_role` or secret key to browser code.

4. Deploy the app to an HTTPS static host. This repository includes a GitHub Actions workflow for GitHub Pages; in repository Settings → Pages, select **GitHub Actions** as the build and deployment source. After the workflow deploys, use its site URL as the Supabase **Site URL** in Authentication → URL Configuration and add it to the allowed redirect URLs too.
5. In Authentication → Providers, enable Email. Create an account in Pocketwise, confirm your email if Supabase asks you to, then sign in.

Once signed in, expenses and the monthly budget load from your account and save to Supabase. Signing out returns to device-local data. If this browser already has local expenses, choose **Import local data** to merge those expenses into the account; the local budget replaces the account budget. Imports can be repeated safely.

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
