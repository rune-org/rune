-- script: aggregate.lua
-- KEYS[1]: results_hash_key
-- KEYS[2]: count_key
-- KEYS[3]: expected_key
-- ARGV[1]: item_index
-- ARGV[2]: item_result_json

-- 1. Save the result for this specific item
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])

-- 2. Increment the "Arrived" counter
local current = redis.call('INCR', KEYS[2])

-- 3. Fetch the target total (set by Split)
local total_str = redis.call('GET', KEYS[3])
if not total_str then
    return redis.error_reply("ERR_MISSING_TOTAL: Split did not initialize expected count")
end
local total = tonumber(total_str)

-- 4. Check Barrier
if current == total then
    -- BARRIER OPEN!
      
    -- Fetch all items in order 0..N-1
    local combined = {}
    for i=0, (total-1) do
        local val = redis.call('HGET', KEYS[1], tostring(i))
        if not val then 
            -- Should not happen in reliable messaging, but handle gracefully
            table.insert(combined, "null") 
        else
            table.insert(combined, val)
        end
    end
      
    -- Cleanup Keys
    redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
      
    -- Return JSON array string
    return cjson.encode(combined)
else
    -- Barrier still closed
    return nil
end
