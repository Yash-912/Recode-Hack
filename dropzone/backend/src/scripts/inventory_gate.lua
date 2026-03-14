-- inventory_gate.lua
-- The Atomic Gate: check-and-decrement as a single, uninterruptible operation.
-- Redis executes Lua scripts atomically — while this script runs,
-- no other Redis command can execute. This is the core innovation.
--
-- KEYS[1] = inventory key (e.g., "inventory:<productId>")
-- ARGV[1] = requested quantity
--
-- Returns:
--   >= 0  : success — remaining stock after decrement
--   -1    : product not found / not initialised
--   -2    : sold out (insufficient stock)

local key = KEYS[1]
local requested = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key))

if current == nil then
  return -1
end

if current >= requested then
  local remaining = redis.call('DECRBY', key, requested)
  return remaining
else
  return -2
end
