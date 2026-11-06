-- Dipakai user:
--   script_key = "SX-XXXX-XXXX-XXXX"
--   loadstring(game:HttpGet("https://stealth-x.com/loader.lua"))()
local SDK = loadstring(game:HttpGet("https://stealth-x.com/sdk.lua"))()
local key = getgenv().script_key or script_key

local r = SDK.check(key)
if not r.ok then return SDK.kick(r.code) end

local name = "Unknown"
pcall(function() name = game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name end)
SDK.heartbeat(key, game.PlaceId, name)

-- Server memilih script berdasarkan PlaceId (lihat data/games.json), fallback ke "Universal"
local ok, err = SDK.load(key, game.PlaceId)
if not ok then SDK.kick(tostring(err)) end
