# Multi-Tenant Architecture Plan: "Add New Website"

Currently, Insight-OS is a "Single-Tenant" MVP running on a hardcoded `test-site-id`. To upgrade this to a fully scalable SaaS platform where users can add multiple unique websites, we need to introduce **Multi-Tenancy**. 

Here is the step-by-step roadmap to implement this while preserving the lightweight script-embedding flow.

---

### Phase 1: Database Restructuring
We need to introduce a `Site` model in Prisma so the database can distinguish between different websites.

1. **Update `schema.prisma`**:
   ```prisma
   model Site {
     id        String   @id @default(uuid())
     domain    String   @unique // e.g. "myblog.com"
     name      String   // e.g. "My Personal Blog"
     createdAt DateTime @default(now())
     events    Event[]  // Relation to events
     funnels   Funnel[] // Relation to funnels 
   }
   ```
2. **Modify Event Table**: Change `siteId String` to relate directly to `Site.id`.
3. **Run Migration**: Execute `npx prisma db push` to alter the Postgres schema.

---

### Phase 2: The "Add Website" Onboarding UI
We will create a new modal or dedicated page (`/dashboard/add-site`) with a sleek glassmorphic form.

1. **The Form**: The user inputs their Domain Name (e.g. `https://mywebsite.com`) and Site Name.
2. **The API Route**: The form submits to `POST /api/sites`. The backend generates a unique `uuid` for the property and saves the `Site`.
3. **The Snippet Generator**: Once saved, the UI reveals a code block component that dynamically injects the new `site.id` into the tracking script:
   ```html
   <!-- Paste this into your website's <head> -->
   <script 
     defer 
     data-site="YOUR_NEW_UUID_HERE" 
     src="https://insight-os.vercel.app/tracker.js">
   </script>
   ```

---

### Phase 3: Dashboard Context Switching
Right now, the dashboard fetches `/api/stats?site_id=test-site-id` unconditionally. We need to make this dynamic.

1. **Global Site Context**: Implement a React Context (`SiteProvider`) to store the "Currently Active Site".
2. **Top Navigation Dropdown**: Add a sleek dropdown menu to the `TopNav` header. It will fetch all registered sites from the database (`GET /api/sites`) and allow the user to easily switch contexts.
3. **Dynamic Fetching**: Make every single dashboard hook and chart dynamically react to the active `Site.id`. When the user switches from "My Blog" to "My E-Commerce Store", the entire dashboard will smoothly re-fetch that specific site's telemetry.

---

### Phase 4: Ingestion Security (CORS)
Currently, `app/api/collect/route.ts` accepts data from any domain. To protect the user's data from completely random script injection:
1. When `/api/collect` receives an event, it will read the incoming `Origin` and the `siteId` payload.
2. The server compares the `Origin` to the registered `Site.domain`. 
3. If someone steals the script but runs it on `random-hacker.com`, the server rejects it.

---

### The Alternative Proxy Overlay Method (If Required)
If you specifically meant a *"Clarity/VWO-style magic preview"* where you **never** embed a script:
We would build a `Proxy Injector Server`. 
1. The user types `apple.com`.
2. Our backend fetches the raw HTML from `apple.com`.
3. The server programmatically splices `<script src="tracker.js">` into the raw HTML string, rewrites all relative links into absolute links, and serves it back to the user inside a fullscreen `<iframe>`.
4. *Note:* This proxy method gets very tricky with modern sites blocking cross-origin requests (CORS/CSP), so the standard **Script Embedding** is widely considered the industry standard for production reliability.
