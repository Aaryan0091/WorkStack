# 📘 WorkStack — Complete Project Documentation

> **The intelligent bookmark and activity management platform.**
> Built with Next.js 16 · React 19 · TypeScript · Supabase · Groq AI

---

## 🏗️ Recommended Notion Structure

Use this page hierarchy for maximum efficiency:

```
📘 WorkStack (Database: Project Wiki)
├── 🏠 Overview & Architecture
├── 🛣️ Pages & Routes
├── 🔌 API Reference
├── 🗄️ Database Schema
├── 🧩 Components
├── 📚 Libraries & Utilities
├── 🧠 AI Integration
├── 🧩 Browser Extension
├── ⚙️ Configuration & Deployment
├── 🔐 Auth & Security
└── 📋 Changelog / Decisions Log
```

**Notion Tips:**
- Create each section as a **sub-page** (not a heading inside one giant page)
- Use **Notion databases** for API routes and DB schema (table view = instant reference)
- Use **toggles** for code blocks to keep pages scannable
- Tag pages with `frontend`, `backend`, `extension`, `database` for filtering

---

## 🏠 Overview & Architecture

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.1 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5+ |
| Styling | Tailwind CSS | 4+ |
| Database | Supabase (PostgreSQL) | - |
| Auth | Supabase Auth | @supabase/ssr 0.8.0 |
| AI | Groq SDK (llama-3.1-8b-instant) | 0.37.0 |
| Drag & Drop | @dnd-kit | 6.3.1 |
| Icons | lucide-react | 0.563.0 |
| Dates | date-fns | 4.1.0 |
| Theme | next-themes | 0.4.6 |
| State | Zustand + React hooks | 5.0.9 |
| Archive | archiver | 7.0.1 |

### Project Structure

```
workstack/
├── app/                    # Next.js App Router (pages + API)
│   ├── api/                # 25+ API endpoints
│   ├── bookmarks/          # Bookmark management page
│   ├── collections/        # Collections + [id] detail
│   ├── tags/               # Tag management
│   ├── reading-list/       # Unread bookmarks
│   ├── tracked-activity/   # Activity history
│   ├── smart-search/       # AI-powered search
│   ├── shared/[slug]/      # Public shared collections
│   ├── extension/          # Extension download page
│   ├── login/              # Auth page
│   ├── auth/callback/      # OAuth handler
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Dashboard
│   └── dashboard-content.tsx # Dashboard logic (large)
├── components/             # Reusable UI components
│   ├── auth/               # Login, Signup, Google OAuth
│   ├── dashboard/          # Charts
│   └── ui/                 # Button, Card, Modal, Toast, etc.
├── lib/                    # Shared utilities
│   ├── supabase.ts         # DB client (singleton)
│   ├── ai-tagging.ts       # Groq AI tagging logic
│   ├── guest-storage.ts    # SessionStorage for guests
│   ├── middleware.ts        # Session refresh logic
│   └── types.ts            # TypeScript interfaces
├── public/extension/       # Browser extension source
├── supabase/migrations/    # Database migrations
├── proxy.ts                # Next.js 16 middleware (proxy)
└── package.json
```

### Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Auth | Supabase Auth + Google OAuth | Built-in RLS, easy session management |
| AI | Groq (llama-3.1-8b-instant) | Fast inference, free tier, good for tagging |
| Guest mode | SessionStorage | No account needed, clears on tab close, syncs on signup |
| Extension | Manifest V3 | Chrome requirement, service worker based |
| State | React hooks (not Zustand stores) | Simpler for page-scoped state |
| Realtime | Supabase Channels | Instant bookmark updates across tabs |

---

## 🛣️ Pages & Routes

### Page Map

| Route | File | Purpose | Auth Required |
|-------|------|---------|:---:|
| `/` | `app/page.tsx` | Dashboard — stats, recent bookmarks, tracking | No (guest OK) |
| `/login` | `app/login/page.tsx` | Login/Signup with Google OAuth | No |
| `/auth/callback` | `app/auth/callback/page.tsx` | OAuth redirect handler | No |
| `/bookmarks` | `app/bookmarks/page.tsx` | Full bookmark manager — search, filter, CRUD | No (guest OK) |
| `/collections` | `app/collections/page.tsx` | All collections — create, search, share | Yes |
| `/collections/[id]` | `app/collections/[id]/page.tsx` | Single collection with its bookmarks | Yes |
| `/tags` | `app/tags/page.tsx` | Tag manager — create, edit, merge, bulk delete | Yes |
| `/reading-list` | `app/reading-list/page.tsx` | Unread bookmarks queue | Yes |
| `/tracked-activity` | `app/tracked-activity/page.tsx` | Browsing activity — time per site, filters | Yes |
| `/smart-search` | `app/smart-search/page.tsx` | AI search — semantic, tags, name, all modes | Yes |
| `/shared/[slug]` | `app/shared/[slug]/page.tsx` | Public shared collection (no auth) | No |
| `/extension` | `app/extension/page.tsx` | Extension download + install guide | No |

### Page Details

#### Dashboard (`/`)
- Time-based greeting ("Good morning")
- Quick stats: total bookmarks, favorites, unread count
- Recent bookmarks (last 5)
- Activity tracking controls (Start/Stop/Pause/Resume)
- Live tracked tabs list (from extension, polled every 2s)
- Previous activity modal
- Extension install prompt (Chromium browsers only)
- Lazy-loaded charts
- Guest mode support with sync prompt

#### Bookmarks (`/bookmarks`)
- Grid/list view of all bookmarks
- Search by title, URL, description
- Filter by collection, tags, read status, favorites
- Add bookmark with URL auto-detection
- Import bookmarks from JSON file
- Inline tag editing
- Mark read/unread, favorite/unfavorite
- Delete with undo toast
- Real-time updates via Supabase channel

#### Collections (`/collections`)
- Create new collection
- Search and filter collections
- Grid layout with bookmark counts
- Share settings (public/private)
- Share code generation
- Add shared collection by code
- Role-based access (owner/editor/viewer)
- Remove/leave collection

#### Tags (`/tags`)
- Create/edit/delete tags with colors
- Bulk selection and bulk delete
- Merge similar tags
- Sort by name, count, or date
- Keyboard navigation (arrow keys)
- Fuzzy matching for similar tag detection
- Undo on delete

#### Smart Search (`/smart-search`)
- 4 search modes:
  - **All**: Combined full-text + semantic + tags
  - **Semantic**: AI-powered meaning-based search
  - **Tags**: Filter by tag names
  - **Name**: Title and URL text search
- Collection filter dropdown
- Client-side instant search
- Debounced API calls for semantic mode
- Scoring: title (10pts), description (5pts), tags (6pts), URL (3pts)

#### Activity Tracking (`/tracked-activity`)
- Time filters: Today, This Week, This Month
- Stats cards: Unique Sites, Total Minutes, Total Hours
- Grouped by URL with visit counts
- Favicon display
- Smart title generation (YouTube video IDs, channel names)
- Extension status check
- Re-fetches on tab visibility change

---

## 🔌 API Reference

> **Tip:** In Notion, create this as a **database** with columns: Endpoint, Method, Auth, Description, Request, Response

### Bookmarks API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookmarks` | Create bookmark (auto-tags via AI in background) |
| GET | `/api/bookmarks` | List user's bookmarks |
| PATCH | `/api/bookmarks/[id]` | Update bookmark fields |
| DELETE | `/api/bookmarks/[id]` | Delete bookmark + cleanup unused tags |
| POST | `/api/bookmarks/[id]/open` | Record last_opened_at timestamp |

**POST /api/bookmarks — Create**
```
Request:  { url, title?, description?, notes?, folder_id?, collection_id? }
Response: { bookmark, updated? }
Status:   201 (created), 409 (duplicate), 400 (invalid)
Notes:    Triggers background AI auto-tagging via /api/ai/auto-tag
```

### Collections API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections` | Get all collections (or default) |
| POST | `/api/collections` | Add bookmark to default collection |
| POST | `/api/collections/add-shared` | Join collection by share code |
| POST | `/api/collections/remove` | Leave/remove a collection |
| GET | `/api/collections/[id]/share` | Get share settings |
| PUT | `/api/collections/[id]/share` | Update public/private + generate share slug |

**POST /api/collections/add-shared**
```
Request:  { code }  (accepts share_code, collection_id, or share_slug)
Response: { message, collection, role, sharedCollection }
Roles:    owner (public collection), editor (public), viewer (private)
```

### Activity API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/activity` | Batch insert activities (legacy) |
| GET | `/api/activity` | Get today's activities with summary |
| PUT | `/api/activity` | Upsert activity by URL |
| DELETE | `/api/activity` | Delete activities by domain |
| POST | `/api/activity/list` | Get all activities (latest per session+tab) |
| POST | `/api/activity/sync-tab` | Sync single tab (extension uses this) |
| POST | `/api/activity/upsert` | Accumulate time for a URL |
| POST | `/api/activity/update-url` | Update URL of existing entry |
| POST | `/api/activity/remove` | Remove by URL |
| POST | `/api/activity/clear` | Clear all user activity |
| POST | `/api/activity/clear-old` | Clear activity older than date |

**POST /api/activity/sync-tab — Main Extension Endpoint**
```
Request:  { url, title?, domain?, tracking_session_id, tab_id, elapsed_seconds }
Response: { success, action: "created"|"updated", record_id, duration_seconds }
Notes:    ONE entry per (tracking_session_id + tab_id). Updates URL/title/duration in place.
```

### AI API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/auto-tag` | Auto-tag a bookmark using Groq AI |
| POST | `/api/ai/search` | Unified search (semantic + tags + name) |
| POST | `/api/ai/semantic-search` | Pure semantic search with query expansion |
| GET | `/api/ai/suggest-tags` | Check if AI is enabled |
| POST | `/api/ai/suggest-tags` | Generate tag suggestions for a URL |
| POST | `/api/ai/recommend` | Recommendations based on reading list |

**AI Model:** `llama-3.1-8b-instant` · Temperature: 0.3 · Max tokens: 150

**Auto-tagging Flow:**
1. Generate AI tags from bookmark URL/title/description
2. Fuzzy-match against existing user tags (70% Levenshtein similarity)
3. Create new tags if no match (with auto-assigned colors)
4. Associate via bookmark_tags junction table
5. Fallback to domain + keyword extraction if AI unavailable

### Other API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard stats (uses RPC function with query fallback) |
| POST | `/api/check-links` | Check if single bookmark URL is alive |
| GET | `/api/check-links` | Check all bookmarks (max 50, 100ms delay) |
| GET | `/api/extension-download` | Redirect to extension ZIP download |
| POST | `/api/sync-guest` | Sync guest sessionStorage data to account |

**All API routes use:**
- `Authorization: Bearer {access_token}` header
- Service role key for RLS bypass where needed
- Consistent `{ success, data/error }` response format

---

## 🗄️ Database Schema

> **Tip:** In Notion, create this as a **database** with columns: Table, Column, Type, Constraints, Notes

### Tables Overview

| Table | Purpose | RLS |
|-------|---------|:---:|
| `bookmarks` | Core bookmark storage | ✅ User-scoped |
| `tags` | Tag definitions with colors | ✅ User-scoped |
| `bookmark_tags` | Many-to-many bookmark↔tag | ✅ Via bookmark ownership |
| `collections` | Named groups of bookmarks | ✅ Owner + shared access |
| `collection_bookmarks` | Many-to-many collection↔bookmark | ✅ Complex visibility rules |
| `shared_collections` | Access control for collections | ✅ |
| `removed_collections` | "Left" collections (soft delete) | ✅ User-scoped |
| `removed_collection_bookmarks` | Hidden bookmarks (soft delete) | ✅ User-scoped |
| `tab_activity` | Browsing time tracking | ✅ User-scoped |

### bookmarks

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| user_id | UUID | FK → auth.users |
| url | TEXT | Unique per user |
| title | TEXT | |
| description | TEXT | |
| notes | TEXT | User notes |
| is_read | BOOLEAN | Reading list status |
| is_favorite | BOOLEAN | |
| favicon_url | TEXT | |
| screenshot_url | TEXT | |
| collection_id | UUID | DEPRECATED — use collection_bookmarks |
| folder_id | UUID | FK → folder |
| last_opened_at | TIMESTAMPTZ | Updated via /api/bookmarks/[id]/open |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### tags

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| name | TEXT | |
| color | TEXT | Hex color code |
| created_at | TIMESTAMPTZ | |

### bookmark_tags

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| bookmark_id | UUID | FK → bookmarks (CASCADE) |
| tag_id | UUID | FK → tags (CASCADE) |
| created_at | TIMESTAMPTZ | |
| | | UNIQUE(bookmark_id, tag_id) |

### collections

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users (owner) |
| name | TEXT | |
| description | TEXT | |
| is_public | BOOLEAN | Controls share visibility |
| share_slug | TEXT | UNIQUE — generated when made public |
| share_code | TEXT | UNIQUE — 8-char random code |
| created_at | TIMESTAMPTZ | |

### collection_bookmarks

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| collection_id | UUID | FK → collections (CASCADE) |
| bookmark_id | UUID | FK → bookmarks (CASCADE) |
| added_by | UUID | FK → auth.users (auto-set via trigger) |
| bookmark_created_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| | | UNIQUE(collection_id, bookmark_id) |

**RLS rules for collection_bookmarks:**
- SELECT: Owner sees all; public collection members see all; private collection members see only owner's additions
- INSERT: Owner or editor role
- DELETE: Owner of collection or the user who added the bookmark

### shared_collections

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| collection_id | UUID | FK → collections (CASCADE) |
| user_id | UUID | FK → auth.users (CASCADE) |
| role | TEXT | `owner`, `editor`, `viewer` |
| created_at | TIMESTAMPTZ | |
| | | UNIQUE(collection_id, user_id) |

### tab_activity

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| url | TEXT | |
| title | TEXT | |
| domain | TEXT | Extracted hostname |
| duration_seconds | INTEGER | Accumulated active time |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| tracking_session_id | TEXT | Groups tabs in one session |
| tab_id | TEXT | Browser tab ID |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### SQL Functions

**`get_user_bookmark_stats(p_user_id UUID)`**
- Returns: `total_bookmarks`, `favorites_count`, `unread_count`
- Used by `/api/stats` for fast dashboard loading
- Fallback: 3 parallel COUNT queries

### Migrations (chronological)

| Migration | Purpose |
|-----------|---------|
| `20250128000000` | Create collection_bookmarks junction table, migrate from collection_id |
| `20260129095200` | Recreate collection_bookmarks safely (idempotent) |
| `20260131100000` | Add last_opened_at to bookmarks |
| `20260131110000` | Add shared_collections table + share_code |
| `20260131110002` | Add added_by + bookmark_created_at to collection_bookmarks |
| `20260131110003` | Complex RLS for private vs public collection_bookmarks |
| `20260131110004` | Allow reading auth.users for attribution |
| `20260131110005` | Add removed_collections table |
| `20260131110006` | Add removed_collection_bookmarks table |

---

## 🧩 Components

### Auth Components (`components/auth/`)

| Component | File | Purpose |
|-----------|------|---------|
| LoginForm | `login-form.tsx` | Email/password login |
| SignupForm | `signup-form.tsx` | Account creation |
| GoogleSignInButton | `google-signin-button.tsx` | Google OAuth button |

### Layout Components (`components/`)

| Component | File | Purpose |
|-----------|------|---------|
| DashboardLayout | `dashboard-layout.tsx` | Main layout wrapper with sidebar |
| Sidebar | `sidebar.tsx` | Navigation menu + user info |
| ThemeProvider | `theme-provider.tsx` | Dark/light mode (next-themes) |
| ErrorBoundary | `error-boundary.tsx` | React error boundary wrapper |
| ExtensionSync | `extension-sync.tsx` | Syncs auth token to browser extension |
| GuestSyncPrompt | `guest-sync-prompt.tsx` | Prompts guest to sign up |
| OpenTabsModal | `open-tabs-modal.tsx` | View/manage browser tabs (extension) |
| BookmarkMenu | `bookmark-menu.tsx` | Context menu: favorite, read, edit, delete |

### UI Primitives (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| Button | Standard button with variants |
| Input | Text input with label |
| Card / CardContent | Content container |
| Modal | Dialog overlay |
| Toast | Notification popup |
| LoadingSkeleton | Animated loading placeholder |

### Dashboard Components (`components/dashboard/`)

| Component | Purpose |
|-----------|---------|
| ChartWithToggle | Activity stats charts (lazy-loaded) |

---

## 📚 Libraries & Utilities

### `lib/supabase.ts` — Database Client
- Singleton pattern
- Browser: `createBrowserClient` from `@supabase/ssr` (handles cookies)
- Server: `createClient` from `@supabase/supabase-js`
- Auto token refresh built into browser client

### `lib/ai-tagging.ts` — AI Tagging Engine
- `generateAITags(url, title, description)` → AI-generated tags
- `fuzzyMatchTag(aiTag, existingTags)` → 70% Levenshtein similarity threshold
- `createFallbackTags(url, title)` → domain + keyword extraction
- Color assignment from predefined palette
- Handles: rate limits, timeouts, parse errors with fallbacks

### `lib/guest-storage.ts` — Guest Mode
- `guestStoreGet<T>(key)` / `guestStoreSet(key, value)`
- Uses `sessionStorage` (clears on tab close)
- Keys: `BOOKMARKS`, `COLLECTIONS`, `TAGS`
- `markGuestMode()` — flags session as guest
- Data synced to account on signup via `/api/sync-guest`

### `lib/api-response.ts` — API Helpers
- Standardized response formatting
- Error handling wrapper
- CORS headers

### `lib/types.ts` — TypeScript Interfaces
- `Bookmark`, `Tag`, `BookmarkTag`, `Collection`, `TabActivity`
- Shared across client and API routes

### `lib/utils.ts` — General Utilities
- URL validation, string helpers
- Domain extraction

### `lib/middleware.ts` — Session Refresh
- Called by `proxy.ts` on every page navigation
- Creates Supabase server client with cookie handling
- Calls `getUser()` to validate and refresh expired tokens
- Redirects `/login` → `/` if already authenticated

### `lib/browser-detect.ts` — Browser Detection
- Detects Chrome, Firefox, Safari, Edge, Brave
- Used by extension download page

### `lib/extension-detect.ts` — Extension Detection
- `isExtensionInstalledViaContentScript()` — checks `window.workStackExtensionInstalled`
- `getExtensionId()` — reads `window.workStackExtensionId`
- Used to conditionally show extension features

---

## 🧠 AI Integration (Groq)

### Configuration
- **Model:** `llama-3.1-8b-instant`
- **Temperature:** 0.3 (deterministic)
- **Max tokens:** 150
- **API Key:** `GROQ_API_KEY` (server-side only)

### Features

| Feature | Endpoint | How It Works |
|---------|----------|-------------|
| Auto-tagging | `/api/ai/auto-tag` | Bookmark created → AI generates tags → fuzzy match to existing → create new if needed |
| Semantic search | `/api/ai/semantic-search` | Query → AI expands to synonyms → score all bookmarks → return ranked |
| Tag suggestions | `/api/ai/suggest-tags` | URL + title → AI suggests tags → present to user |
| Recommendations | `/api/ai/recommend` | Analyze reading list → find related bookmarks → return top 12 |
| Unified search | `/api/ai/search` | Combines all modes: semantic + tags + name + full-text |

### Scoring Algorithm (Search)
| Match Type | Points |
|-----------|--------|
| Title match | +10 |
| Tag match | +6 |
| Description match | +5 |
| URL match | +3 |
| Expanded term in title | +4 |
| Expanded term elsewhere | +1 |

### Fallback Chain
1. Groq AI generates tags → ✅ Use them
2. API key missing → Use domain + keyword extraction
3. API timeout → Fallback tags
4. Rate limited → Fallback tags
5. Parse error → Fallback tags

---

## 🧩 Browser Extension

### Overview
- **Name:** WorkStack Tab Tracker
- **Version:** 5.0.0
- **Manifest:** V3 (Service Worker)
- **Permissions:** tabs, storage, idle, alarms

### Architecture

```
popup.html/popup.js    ←→    background.js    ←→    WorkStack API
     ↕                            ↕
  popup UI               content.js (on WorkStack pages)
                               ↕
                        WorkStack website
```

### How Tracking Works
1. User clicks "Track Activity" on dashboard
2. Dashboard sends `startTracking` message to extension (via `chrome.runtime.sendMessage`)
3. Extension generates `trackingSessionId`, starts monitoring tabs
4. On tab switch (`onActivated`): accumulate time on previous tab, start timing new tab
5. On tab navigate (`onUpdated`): update URL/title in `tabTimes` map, sync to server
6. On new tab (`onCreated`): start tracking immediately if URL is valid
7. Every 10 seconds: sync active tab duration to server via `/api/activity/sync-tab`
8. Keep-alive alarm every 1 minute prevents service worker termination

### Extension Messages

| Action | Direction | Purpose |
|--------|-----------|---------|
| `startTracking` | Website → Extension | Begin tracking session |
| `stopTracking` | Website → Extension | End session, save tabs |
| `pauseTracking` | Website → Extension | Pause time accumulation |
| `resumeTracking` | Website → Extension | Resume tracking |
| `getStatus` | Website → Extension | Get isTracking, sessionTabs |
| `storeAuthToken` | Website → Extension | Pass auth token |
| `getOpenTabs` | Website → Extension | Get all browser tabs |
| `openSavedTabs` | Website → Extension | Restore saved session |
| `ping` | Website → Extension | Check extension alive |

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `background.js` | ~634 | Service worker — tracking logic, API sync, tab management |
| `content.js` | 48 | Injected into WorkStack pages — announces extension presence |
| `popup.html` | 87 | Extension popup UI |
| `popup.js` | ~400 | Popup logic — status display, quick actions, collection picker |
| `manifest.json` | 42 | Extension configuration |
| `styles.css` | - | Popup styling |

---

## ⚙️ Configuration & Deployment

### Environment Variables

| Variable | Type | Required | Purpose |
|----------|------|:--------:|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_KEY` | Secret | ✅ | Supabase service role key (bypasses RLS) |
| `GROQ_API_KEY` | Secret | ✅ | Groq API key for AI features |

### Deployment (Vercel)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add all 4 environment variables in Vercel project settings
4. Deploy — Vercel auto-detects Next.js
5. Update extension's `manifest.json` host_permissions with production URL
6. Run Supabase migrations on production database

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (dev/build/start/lint) |
| `next.config.ts` | Turbopack root, compression, image optimization, package optimization |
| `proxy.ts` | Next.js 16 middleware — session refresh, login redirect (skips /api) |
| `tsconfig.json` | Strict mode, ES2017 target, `@/*` path alias |
| `postcss.config.mjs` | Tailwind CSS v4 plugin |
| `eslint.config.mjs` | Next.js Core Web Vitals rules |

### NPM Scripts

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

---

## 🔐 Auth & Security

### Auth Flow

```
Guest (sessionStorage) → Sign Up → Supabase Auth → OAuth Callback
                                        ↓
                              Session Cookie Set
                                        ↓
                          proxy.ts refreshes on every page load
                                        ↓
                         Extension synced via ExtensionSync component
```

### Security Measures
- **RLS on every table** — users can only access their own data
- **Service key server-only** — never exposed to client
- **Bearer token auth** — all API routes validate token via `getUser()`
- **CORS headers** — on API responses
- **Guest data isolation** — sessionStorage (clears on tab close)
- **Share codes** — 8-char random for collection sharing
- **Ownership verification** — bookmark/collection actions check user_id

### Token Refresh
- **Server-side:** `proxy.ts` → `updateSession()` → `getUser()` refreshes cookie on page navigation
- **Client-side:** `createBrowserClient` auto-refreshes JWT before expiry
- **Realtime:** Channel auto-reconnects on `CHANNEL_ERROR` / `TIMED_OUT`
- **Visibility:** Dashboard re-fetches data when tab becomes visible after idle

---

## 📋 Feature Checklist

### Core
- ✅ Bookmark CRUD (create, read, update, delete)
- ✅ Tag system with colors
- ✅ Collections with sharing
- ✅ Reading list (unread queue)
- ✅ Full-text search
- ✅ Guest mode (no account required)

### AI-Powered
- ✅ Auto-tagging on bookmark creation
- ✅ Semantic search (meaning-based)
- ✅ Tag suggestions
- ✅ Bookmark recommendations
- ✅ Query expansion (synonyms)

### Activity Tracking
- ✅ Time per website tracking
- ✅ Session management (start/stop/pause/resume)
- ✅ Daily/weekly/monthly filters
- ✅ Domain statistics
- ✅ Previous session restore

### Collaboration
- ✅ Public/private collections
- ✅ Share by code, slug, or ID
- ✅ Role-based access (owner/editor/viewer)
- ✅ Attribution (who added which bookmark)
- ✅ Soft leave (remove without deleting)

### Extension
- ✅ Tab tracking with time accumulation
- ✅ Quick bookmark from any page
- ✅ Quick add to collection
- ✅ Session save/restore
- ✅ Auth token sync
- ✅ Popup with status and actions

### UX
- ✅ Dark/light mode
- ✅ Mobile responsive
- ✅ Keyboard navigation (tags page)
- ✅ Loading skeletons
- ✅ Undo on destructive actions
- ✅ Drag and drop (dnd-kit)
- ✅ Lazy-loaded charts
- ✅ Favicon display for bookmarks
