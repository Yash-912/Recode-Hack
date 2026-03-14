# 🧪 Phase 8 Testing Guide

## Quick Verification Checklist

Run through this 10-minute checklist to verify Phase 8 is working:

### 1. Error Boundary ✅
```
[ ] Open any page
[ ] Open browser DevTools Console
[ ] Execute: document.querySelector('button').onclick = () => { throw new Error('Test'); }
[ ] Click the button
[ ] Should see error boundary UI (not white screen)
[ ] Click "Home" and app recovers
```

### 2. 404 Page ✅
```
[ ] Navigate to: http://localhost:5173/this-does-not-exist
[ ] Should see 404 page with FileQuestion icon
[ ] Click "Go Back" → should go back
[ ] Click "Home" → should go to home page
```

### 3. Accessibility - Keyboard Navigation ✅
```
[ ] Open http://localhost:5173/sale
[ ] Press Tab repeatedly
[ ] Should highlight all interactive elements (buttons, links)
[ ] Shift+Tab reverses navigation
[ ] Press Enter on a product "Add to Cart" button
[ ] Should trigger action successfully
[ ] Can navigate entire page without mouse
```

### 4. Accessibility - Screen Reader (macOS) ✅
```
[ ] Press Cmd+F5 to enable VoiceOver
[ ] Navigate with VO+Right Arrow
[ ] Should hear:
    - "DropCart, image"
    - "Products, link" (with aria-current if active)
    - "Midnight Hoodie, region"
    - "Add to Cart button"
[ ] Disable with Cmd+F5
```

### 5. Accessibility - ARIA Labels ✅
```
[ ] Open http://localhost:5173/sale
[ ] Open DevTools → Elements tab
[ ] Find any <button> element
[ ] Should have aria-label attribute
[ ] Example: aria-label="Add to Cart for Midnight Hoodie"
[ ] Find product <img> elements
[ ] Should have descriptive alt text
[ ] Example: alt="Midnight Hoodie product image"
```

### 6. Image Lazy Loading ✅
```
[ ] Open http://localhost:5173/sale
[ ] Open DevTools → Network tab
[ ] Scroll down to see more products
[ ] Look for images loading on-demand as you scroll
[ ] They should have loading="lazy" attribute
[ ] Can verify: Inspect image → loading="lazy"
```

### 7. Drop Page Route ✅
```
[ ] Go to http://localhost:5173/control (Admin)
[ ] Enter token: dropzone-admin-secret
[ ] Create a product named "Midnight Hoodie"
[ ] Copy the Product ID from the created product message
[ ] Navigate to: http://localhost:5173/drops/[PRODUCT_ID]
[ ] Should see drop page with:
    - Countdown timer
    - Stock indicator
    - Viewer count
    - Buy button (if drop is live)
    - All real-time metrics updating
```

### 8. Loading Spinner ✅
```
[ ] Temporarily add delay to a route component:
    const [ready, setReady] = useState(false)
    useEffect(() => setTimeout(() => setReady(true), 2000), [])
    if (!ready) return null
[ ] Navigate to that route
[ ] Should see loading spinner (rotating blue circle)
[ ] After 2 seconds, component renders
```

### 9. Error Boundary Stack Trace ✅
```
[ ] Follow step 1 (trigger error)
[ ] See error boundary error screen
[ ] Click "Error Details" dropdown
[ ] Should see readable error stack trace
[ ] Helpful for debugging
```

### 10. NotFound Page Accessibility ✅
```
[ ] Navigate to /nonexistent
[ ] See 404 page
[ ] Open DevTools → Accessibility Inspector
[ ] Should see:
    - Proper heading hierarchy (h1 for "404")
    - All buttons have aria-label
    - Focus outline visible on buttons
```

---

## Automated Testing

### Run Test Suite
```bash
cd dropzone/frontend
npm test
```

**Expected Output**:
```
PASS  src/components/ErrorBoundary.test.jsx
PASS  src/pages/NotFound.test.jsx
PASS  src/components/Navbar.test.jsx

Test Suites: 3 passed, 3 total
Tests: 23 passed, 23 total
```

### Accessibility Audit (Axe DevTools)

1. Install Axe DevTools browser extension
2. Open any Dropzone page
3. Run scan: Right-click → Axe DevTools → Scan ALL of my page
4. Should report:
   - Critical Issues: 0
   - Serious Issues: 0 (or minimal)
   - Moderate Issues: <5

**Target Score**: 90%+

---

## Performance Testing

### Lighthouse Audit

1. Open DevTools → Lighthouse tab
2. Select:
   - Mode: Navigation
   - Device: Desktop
   - Category: All
3. Click Analyze page load

**Expected Scores**:
- Performance: 80+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 95+

### Network Analysis

1. Open DevTools → Network tab
2. Set throttling: "Fast 3G"
3. Reload page
4. Check:
   - Total bundle size: <300KB
   - Images lazy loaded: Yes
   - JS chunks separated: Yes

---

## Demo Walkthrough Test

### Pre-Demo Checklist (2 min)

```bash
# Terminal 1: Backend running?
curl http://localhost:3000/health
# Expected: { "status": "ok" }

# Terminal 2: Frontend running?
npm run dev
# Should open http://localhost:5173

# Browser Tab 1: Open admin page
http://localhost:5173/control

# Browser Tab 2: Open product catalog
http://localhost:5173/sale

# Browser Tab 3: Keep ready for drop page
# Will get URL from admin create product
```

### Admin Authentication
```
[ ] Token field shows: "dropzone-admin-secret" placeholder
[ ] Type: dropzone-admin-secret
[ ] Click Authenticate
[ ] Should show admin panel
[ ] Green "Socket Connected" indicator visible
```

### Product Creation
```
[ ] Fill form:
    Name: "Midnight Hoodie"
    Stock: 10
    Price (paise): 299900
    Drop (sec): 60
[ ] Click "Create Product"
[ ] Should show green "Product Created" message
[ ] Copy Product ID
```

### Navigate to Drop Page
```
[ ] URL: http://localhost:5173/drops/[PRODUCT_ID_HERE]
[ ] Should load drop page
[ ] Should see:
    - Product name: "Midnight Hoodie"
    - Countdown timer: ~60 seconds
    - Stock indicator: 10/10 (full)
    - "Waiting for Drop" button (until timer hits 0)
```

### Run Naive Mode Test
```
[ ] Go to Admin tab
[ ] Click "NAIVE MODE" button (red)
[ ] Should turn red and say "ACTIVE"
[ ] Click "Run Load Test (500 reqs)"
[ ] Terminal should start showing output
[ ] Go to Products tab
[ ] Stock bar should quickly deplete to 0
[ ] Look at Admin metrics
[ ] Should show: 500+ "confirmed" orders (OVERSELL)
[ ] This is the problem!
```

### Switch to Protected Mode
```
[ ] Go to Admin tab
[ ] Click reset: "Reset Stock To: 10" then click Reset button
[ ] Click "Unlock Drop NOW"
[ ] Go to Products tab
[ ] Stock should show 10 again
[ ] Go back to Admin tab
[ ] Click "PROTECTED MODE" button (green)
[ ] Should turn green and say "ACTIVE"
```

### Run Protected Mode Test
```
[ ] Click "Run Load Test (500 reqs)"
[ ] Terminal should show output
[ ] Go to Products tab
[ ] Stock bar depletes to 0
[ ] Look at Admin metrics
[ ] Should show: ~10 "confirmed" orders
[ ] Rest should be rejected (409 conflicts)
[ ] Check terminal output
[ ] Should show: 490 rejections, 10 successes
[ ] This is the solution!
```

---

## Troubleshooting

### Issue: Error Boundary Not Working

**Symptom**: Blank white screen when error occurs

**Fix**:
```javascript
// Check 1: ErrorBoundary is in App.jsx and wraps Routes
<ErrorBoundary>
  <SocketProvider>
    <Routes />
  </SocketProvider>
</ErrorBoundary>

// Check 2: Component is using class component or hook throwing
// ErrorBoundary only catches render errors, not event handlers

// Check 3: Check console for actual error
console.error() and DevTools Console
```

### Issue: 404 Page Not Showing

**Symptom**: Navigating to unknown route shows blank page

**Fix**:
```javascript
// Check 1: Route with path="*" exists at END of Routes
<Routes>
  <Route path="/" element={<Landing />} />
  {/* ... other routes ... */}
  <Route path="*" element={<NotFound />} />  {/* MUST be last */}
</Routes>

// Check 2: Navigate to exact wrong path
http://localhost:5173/xyz123
// NOT http://localhost:5173/?page=xyz123
```

### Issue: Images Not Lazy Loading

**Symptom**: All images load immediately even off-screen

**Fix**:
```javascript
// Check 1: Image has loading="lazy" attribute
<img 
  src={...}
  alt={...}
  loading="lazy"  {/* MUST have this */}
/>

// Check 2: Browser supports loading=lazy
// All modern browsers do (Chrome 76+, FF 75+, Safari 15.4+)

// Check 3: Check DevTools Network tab
// Images should load when scrolled into view
```

### Issue: Accessibility Labels Missing

**Symptom**: Screen reader doesn't read button purpose

**Fix**:
```javascript
// Check 1: Button has aria-label
<button aria-label="Add to Cart for Midnight Hoodie">
  Add to Cart
</button>

// Check 2: Link has aria-current
<Link 
  to="/sale"
  aria-current={isActive ? "page" : undefined}
>
  Products
</Link>

// Check 3: Verify with DevTools Accessibility Inspector
// See computed accessibility tree
```

### Issue: Drop Page Returns 404

**Symptom**: `/drops/prod_123` shows 404 instead of drop page

**Fix**:
```javascript
// Check 1: Route exists in App.jsx
<Route path="/drops/:productId" element={<DropPage />} />

// Check 2: Product ID is correct
// Copy from admin panel "Product Created" message
// URL should be: /drops/exactly-as-shown-in-admin

// Check 3: Check backend
// GET /api/products/:id should return product data
curl http://localhost:3000/api/products/prod_123
```

---

## Browser Compatibility

### Desktop
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Mobile
- ✅ iOS Safari 14+
- ✅ Chrome Android 90+

### Accessibility Browsers
- ✅ NVDA (Windows screen reader)
- ✅ JAWS (Windows screen reader)
- ✅ VoiceOver (macOS/iOS)
- ✅ TalkBack (Android)

---

## Final Verification

Before launching, run this comprehensive checklist:

```
FUNCTIONALITY
[ ] All 7 pages load without errors
[ ] Drop page accessible at /drops/:productId
[ ] 404 page appears on unknown routes
[ ] Error boundary catches errors
[ ] Loading spinner shows during delays

ACCESSIBILITY  
[ ] WCAG 2.1 AA Compliance verified with Axe
[ ] Keyboard navigation works on all pages
[ ] Screen reader announces all elements
[ ] Color contrast ratio 4.5:1+ for text
[ ] Focus indicators visible

PERFORMANCE
[ ] Lighthouse score 80+
[ ] Image lazy loading working
[ ] No console errors
[ ] TTI under 5 seconds
[ ] Mobile performance good (<8 seconds)

DEMO
[ ] Admin login works
[ ] Product creation works
[ ] Naive mode oversells (500 > 10)
[ ] Protected mode protects (only 10 sold)
[ ] Load test completes without errors
```

**Once all checked**: ✅ Ready to deploy and demo!

---

## Support

For issues not covered here:

1. Check error message in DevTools Console
2. Check backend logs: `docker logs [container_id]`
3. Check NetworkTab for failed API calls
4. Review relevant component code
5. Check DEMO_SCRIPT.md troubleshooting section

**Quick reference**:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Admin token: `dropzone-admin-secret`
- Demo script: `DEMO_SCRIPT.md`
