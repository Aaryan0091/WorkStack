# WorkStack: How It Works

A bookmark management system with browser extension for activity tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser (Chrome/Brave/Edge)       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Dashboard   │  │  Extension   │  │  Supabase    │
│  │   (React)   │  │ (Content    │  │   (Postgres) │
│  │             │  │   Script)   │  │              │
│  │             │  └──────────────┘  └──────────────┘ │
│  │             │  postMessage     │      HTTP       │
│  └──────────────┘                     │              │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Authentication Flow

User signs in → Supabase Auth → JWT Token → Stored in Extension

```typescript
// User signs in → Supabase returns JWT
// Token stored in chrome.storage.local
chrome.storage.local.set({ authToken, userId, apiBaseUrl })
```

---

## 2. Extension Detection

**Content Script** sends ID → **Dashboard** receives it → **Tracking enabled**

```javascript
// Content script runs on your page
window.postMessage({
  type: 'workstack-extension-installed',
  extensionId: 'chrome-extension-id'
}, '*')

// Dashboard listens and caches the ID
window.addEventListener('message', (event) => {
  if (event.data?.type === 'workstack-extension-installed') {
    cachedExtensionId = event.data.extensionId
  }
})
```

---

## 3. Activity Tracking

**Extension** watches tabs → **Periodically** sends to Supabase:

```javascript
// Every 30 seconds, extension sends tracked activity
chrome.storage.local.get(['authToken'], ({ authToken }) => {
  fetch('/api/activity/sync-tab', {
    method: 'POST',
    body: JSON.stringify({ authToken, url, duration })
  })
})
```

---

## 4. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP
);

-- Bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP
);

-- Activity table
CREATE TABLE tracked_activity (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  url TEXT NOT NULL,
  duration_seconds INT,
  tracked_at TIMESTAMP
);

-- Collections table
CREATE TABLE collections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN
  share_slug TEXT UNIQUE
);
-- Collection bookmarks table
CREATE TABLE collection_bookmarks (
  collection_id UUID REFERENCES collections(id),
  bookmark_id UUID REFERENCES bookmarks(id),
  user_id UUID REFERENCES users(id),
  added_at TIMESTAMP
);
```

---

## 5. Why Extension May Not Detect

1. **Manifest mismatch** - Extension must allow your domain
2. **Content script not running** - Check Console for errors
3. **Message timing** - Page loads before extension announces
4. **CSP blocking** - Content Security Policy may block scripts
5. **Different extension ID** - Each device/browser generates a new ID for unpacked extensions

---

## 6. Key Files

| File | Purpose |
|------|---------|
| `public/extension/manifest.json` | Extension configuration (permissions, matches) |
| `public/extension/content.js` | Content script that runs on WorkStack pages |
| `public/extension/background.js` | Service worker that tracks tabs and communicates with API |
| `lib/extension-detect.ts` | Detection logic for React components |
| `app/dashboard-content.tsx` | Main dashboard UI and tracking controls |
| `app/extension/page.tsx` | Extension download and installation guide |
| `supabase/migrations/` | Database schema definitions |

---

## 7. Environment Variables (Required for Deployment)

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_KEY` | Your service key | Supabase Dashboard > Settings > API |
| `GROQ_API_KEY` | Your Groq API key | https://console.groq.com/keys |
| `NEXT_PUBLIC_APP_URL` | Your Vercel domain | Auto-filled by Vercel |

---

## 8. Deployment Steps

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables
4. Click Deploy

---

## 9. Troubleshooting Extension

**Extension installed but not detected?**
- Reload extension in extensions page (click refresh icon)
- Refresh your WorkStack tab
- Open Console and check for `WorkStack Extension] logs

**Track Activity button not opening permission modal?**
- Open Console and check for detection logs
- Make sure extension's manifest includes your domain

**Getting errors in Console?**
- Look for CSP errors
- Check that extension ID matches
- Verify NEXT_PUBLIC_APP_URL is set correctly
