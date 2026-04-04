# Insight-OS Deployment Plan

You are officially ready to deploy your application to Vercel for the final Hackathon presentation. Since you are using a modern Next.js 14 stack with managed databases (Neon Postgres & Upstash Redis), your app is perfectly optimized for Vercel's edge network.

Follow this exact blueprint to deploy without errors.

---

### Step 1: Push Code to GitHub
Vercel deploys directly from your Git repository. 
1. Open your terminal in the `insight-os` folder.
2. Commit your final changes:
   ```bash
   git add .
   git commit -m "Final Hackathon Build: Multi-Tenant Architecture"
   git push origin main
   ```

### Step 2: Initialize Vercel Deployment
1. Go to [Vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Import the GitHub repository for `insight-os`.
3. In the Configuration screen, leave the Framework preset as **Next.js**. Vercel will automatically detect that your `package.json` has `"build": "prisma generate && next build"`.

### Step 3: Inject Environment Variables (CRITICAL)
Before you click the Deploy button, open the **Environment Variables** tab in Vercel and paste your exact `.env` values. Your app will crash instantly if you forget this!

Copy these keys directly from your local `.env` file:
*   `DATABASE_URL="postgresql://..."` (Your Neon Postgres URI)
*   `UPSTASH_REDIS_REST_URL="https://..."`
*   `UPSTASH_REDIS_REST_TOKEN="..."`
*   `OPENROUTER_API_KEY="..."`

Once injected, click **Deploy**.

---

### Step 4: The Post-Deploy Verification
Once Vercel finishes building (usually takes ~60-90 seconds), you will get a live URL (e.g., `https://insight-os.vercel.app`).

**4.1 Update the External Demo Snippet!**
If you deployed the dummy website (`his-agentic.vercel.app`) externally as discussed, you **must update its HTML snippet**.
You can no longer use `http://localhost:3000/tracker.js`. You must change your snippet to use your new live Vercel domain:
```html
<script defer data-site="cmnjka6mo0000f89psvokch7e" src="https://insight-os.vercel.app/tracker.js"></script>
```

**4.2 Test the Pipeline**
1. Open your external test website on your phone or incognito tab. 
2. Click around to generate traffic.
3. Open your deployed `insight-os.vercel.app/dashboard` window.
4. Watch the traffic flow in live!

---

### Fallback/Emergency Note: White Screens
If Vercel gives you an "Internal Server Error" when you open the dashboard:
1. It means your Vercel Environment Variables (`DATABASE_URL`) were typed incorrectly and Prisma cannot reach Neon. 
2. Go to Vercel Settings -> Environment Variables, fix the typo, and **manually redeploy**.

You are ready for your hackathon pitch. Good luck!
