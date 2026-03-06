# Deployment Guide

This guide is for deploying WorkStack as a hosted service. Users only need to sign up and install the browser extension - no setup required on their end.

---

## Quick Deploy (Vercel)

1. Push your code to GitHub
2. Go to https://vercel.com/new and import your repository
3. Add environment variables (see below)
4. Click "Deploy"

That's it! Your site will be live and ready for users.

---

## Environment Variables (For Your Deployment)

These are YOUR credentials - users don't need to set these up.

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_KEY` | Your service key | Supabase Dashboard > Settings > API |
| `GROQ_API_KEY` | Your Groq API key | https://console.groq.com/keys |
| `NEXT_PUBLIC_APP_URL` | Your Vercel domain | Auto-filled by Vercel |
| `NEXT_PUBLIC_EXTENSION_ID` | Your extension ID (optional) | Chrome Web Store (after publishing) |

---

## Database Setup (One-Time)

1. Create a Supabase project at https://supabase.com
2. Run all migrations from `supabase/migrations/` in SQL Editor:
   ```sql
   -- Run each file in order:
   20250128000000_add_collection_bookmarks_table.sql
   20260129095200_new-migration.sql
   20260131100000_add_last_opened_at_column.sql
   20260131110000_add_shared_collections_table.sql
   20260131110002_add_added_by_to_collection_bookmarks.sql
   20260131110003_update_rls_for_private_collections.sql
   20260131110004_allow_user_read_for_attribution.sql
   20260131110005_add_removed_collections.sql
   20260131110006_add_removed_collection_bookmarks.sql
   ```

3. Enable Email & Google OAuth in Supabase > Authentication > Providers
4. Add your site URL to Auth > URL Configuration > Redirect URLs:
   ```
   https://your-domain.vercel.app/auth/callback
   ```

---

## User Experience

After deployment, users simply:

1. **Visit your site** - `https://your-site.vercel.app`
2. **Sign up** - with email/password or Google
3. **Download extension** - from the Extension page
4. **Install & start using** - that's it!

No configuration needed on the user's end.

---

## Publishing the Extension (Optional)

If you want users to install from Chrome Web Store:

1. Package `public/extension/` as a ZIP file
2. Create Chrome Web Store developer account ($5 fee)
3. Submit extension for review
4. Once approved, add the extension ID to `NEXT_PUBLIC_EXTENSION_ID`

---

## Troubleshooting

**Extension not connecting?**
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly
- Check that CORS is allowing `chrome-extension://` origins

**AI features not working?**
- Verify `GROQ_API_KEY` is set and has available credits
