# Postmark — deployment guide

This is the real, hosted version of Postmark. Everyone who signs up gets their
own private account and their own pitches, no Claude account needed by them.

## What you need (both free to start)
1. A Supabase account — supabase.com
2. A Vercel account — vercel.com
3. Your Anthropic API key — console.anthropic.com > API Keys (this is a
   separate thing from your claude.ai login; it is a developer key, and using
   it will cost a small amount per request once you are live)

## Step 1: Set up Supabase
1. Create a new project at supabase.com (pick any name/region).
2. Once it is created, go to the SQL Editor, paste the entire contents of
   `supabase-schema.sql` from this project, and click Run. This creates the
   two tables (pitches, profiles) and locks each row to its owner.
3. Go to Authentication > Providers and make sure Email is enabled (it is by
   default). Optionally turn off "Confirm email" under
   Authentication > Settings if you want people to sign up without checking
   their inbox during testing.
4. Go to Project Settings > API. Copy the "Project URL" and the "anon public"
   key. You will need both in Step 3.

## Step 2: Push this code to GitHub
1. Create a new empty repository on github.com.
2. From this project folder, run:
   ```
   git init
   git add .
   git commit -m "Postmark v1"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

## Step 3: Deploy on Vercel
1. Go to vercel.com, click "Add New Project," and import the GitHub repo you
   just pushed.
2. Before deploying, open "Environment Variables" and add three:
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL from Step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon public key from Step 1
   - `ANTHROPIC_API_KEY` — your Anthropic API key (no NEXT_PUBLIC_ prefix,
     this one must stay secret)
3. Click Deploy. Vercel gives you a live URL when it finishes
   (something like postmark-app.vercel.app).

## Step 4: Try it yourself first
Open the live URL, create an account, and run through the whole flow once
(new pitch, mark sent, log a reply, draft a follow-up) before sending the
link to anyone else.

## Costs to know about
- Supabase and Vercel free tiers are generous and cost nothing at this scale.
- Every AI draft, revise, or reply analysis calls the Anthropic API using
  your key, and that has a small real cost per call. You are the one paying
  for every user's usage right now, not each person individually. Keep an eye
  on usage at console.anthropic.com if you send this to more than a handful
  of people.

## Local development (optional, only if you want to test changes before
deploying)
1. Copy `.env.local.example` to `.env.local` and fill in the same three
   values.
2. Run `npm install` then `npm run dev`, and open localhost:3000.
