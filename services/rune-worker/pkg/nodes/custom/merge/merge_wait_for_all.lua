-- KEYS[1]: barrier_key ({prefix}:barrier)
-- ARGV[1]: incoming_parent_id
-- ARGV[2]: incoming_payload_json
-- ARGV[3]: expected_parent_count

local barrier_key = KEYS[1]
local arrivals_key = barrier_key .. ":arrivals"
local data_key = barrier_key .. ":data"

-- 1. Register Arrival
redis.call('SADD', arrivals_key, ARGV[1])

-- 2. Store Payload
redis.call('HSET', data_key, ARGV[1], ARGV[2])

-- 3. Check Barrier Condition
local current_count = redis.call('SCARD', arrivals_key)

if tonumber(current_count) == tonumber(ARGV[3]) then
    -- BARRIER OPEN: Retrieve all data
    local all_payloads = redis.call('HGETALL', data_key)

    -- Cleanup Keys
    redis.call('DEL', arrivals_key, data_key, barrier_key)

    return all_payloads
else
    -- BARRIER PENDING
    return nil
end
