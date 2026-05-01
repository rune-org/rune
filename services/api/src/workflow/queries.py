from sqlalchemy import text

# Query to backfill credential links from workflow JSON data.
# Extracts IDs from nodes -> credentials -> id for both latest and published versions.
CREDENTIAL_BACKFILL_QUERY = text("""
    INSERT INTO workflow_credential_links (workflow_id, credential_id, created_at, updated_at)
    SELECT DISTINCT sub.workflow_id, sub.credential_id, NOW(), NOW()
    FROM (
        -- Extract from latest version
        SELECT w.id as workflow_id, (jsonb_array_elements(COALESCE(wv.workflow_data->'nodes', '[]'::jsonb))->'credentials'->>'id')::int as credential_id
        FROM workflows w
        JOIN workflow_versions wv ON w.latest_version_id = wv.id
        UNION
        -- Extract from published version
        SELECT w.id as workflow_id, (jsonb_array_elements(COALESCE(wv.workflow_data->'nodes', '[]'::jsonb))->'credentials'->>'id')::int as credential_id
        FROM workflows w
        JOIN workflow_versions wv ON w.published_version_id = wv.id
    ) sub
    JOIN workflow_credentials wc ON wc.id = sub.credential_id
    ON CONFLICT (workflow_id, credential_id) DO NOTHING;
""")
