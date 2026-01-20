-- Run this in your Supabase SQL Editor to create the optimized stats function
-- This will make the dashboard stats load much faster

create or replace function get_user_bookmark_stats(p_user_id uuid)
returns table (
  total_bookmarks bigint,
  favorites_count bigint,
  unread_count bigint
)
language sql
stable
as $$
  select
    count(*) as total_bookmarks,
    count(*) filter (where is_favorite = true) as favorites_count,
    count(*) filter (where is_read = false) as unread_count
  from bookmarks
  where user_id = p_user_id;
$$;

-- Create index on is_favorite for even better performance
create index if not exists idx_bookmarks_is_favorite on bookmarks(user_id, is_favorite);
create index if not exists idx_bookmarks_is_read on bookmarks(user_id, is_read);
