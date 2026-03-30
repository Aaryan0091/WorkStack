-- Private shared collections should be view-only for non-owners.
-- Public shared collections remain collaborative.

DROP POLICY IF EXISTS "Users can add bookmarks to shared collections" ON collection_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks from shared collections" ON collection_bookmarks;

CREATE POLICY "Users can add bookmarks to editable collections"
ON collection_bookmarks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_bookmarks.collection_id
    AND collections.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM collections
    JOIN shared_collections
      ON shared_collections.collection_id = collections.id
    WHERE collections.id = collection_bookmarks.collection_id
    AND collections.is_public = true
    AND shared_collections.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete bookmarks from editable collections"
ON collection_bookmarks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_bookmarks.collection_id
    AND collections.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM collections
    JOIN shared_collections
      ON shared_collections.collection_id = collections.id
    WHERE collections.id = collection_bookmarks.collection_id
    AND collections.is_public = true
    AND shared_collections.user_id = auth.uid()
  )
);
