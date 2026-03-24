-- RPC function to atomically increment tab_activity duration
-- This prevents race conditions when multiple requests update the same record

CREATE OR REPLACE FUNCTION increment_tab_duration(p_id UUID, p_increment INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_duration INTEGER;
    new_duration INTEGER;
BEGIN
    -- Lock the row and get current duration
    SELECT duration_seconds INTO current_duration
    FROM tab_activity
    WHERE id = p_id
    FOR UPDATE;

    -- If record doesn't exist, return NULL
    IF current_duration IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate new duration
    new_duration := COALESCE(current_duration, 0) + p_increment;

    -- Update the record
    UPDATE tab_activity
    SET duration_seconds = new_duration,
        ended_at = NOW()
    WHERE id = p_id;

    RETURN new_duration;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_tab_duration(UUID, INTEGER) TO authenticated;
