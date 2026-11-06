-- Stealth X SDK
local HttpService = game:GetService("HttpService")
local SDK = { API = "https://stealth-x.com/api" }

local httpReq = request or http_request or (syn and syn.request) or (http and http.request)

local function get(path, q)
	local parts = {}
	for k, v in pairs(q) do
		if v ~= nil then parts[#parts + 1] = k .. "=" .. HttpService:UrlEncode(tostring(v)) end
	end
	local res = httpReq({ Url = SDK.API .. path .. "?" .. table.concat(parts, "&"), Method = "GET" })
	return res.StatusCode, res.Body
end

function SDK.hwid()
	local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
	return ok and id or "unknown"
end

function SDK.executor()
	local ok, name = pcall(function() return identifyexecutor and (identifyexecutor()) end)
	return ok and name or "Unknown"
end

-- Return: { ok, code, tier, expires }
-- code: KEY_VALID | KEY_INVALID | KEY_EXPIRED | KEY_HWID_LOCKED | KEY_BLACKLISTED | NETWORK_ERROR
function SDK.check(key)
	if type(key) ~= "string" or key == "" then return { ok = false, code = "KEY_INVALID" } end
	local ok0, _, body = pcall(get, "/validate", { key = key, hwid = SDK.hwid() })
	if not ok0 then return { ok = false, code = "NETWORK_ERROR" } end
	local ok, data = pcall(HttpService.JSONDecode, HttpService, body)
	return ok and data or { ok = false, code = "NETWORK_ERROR" }
end

-- Ambil & jalankan script dari server (butuh key valid). target = PlaceId (angka) atau id script (string)
function SDK.load(key, target)
	local q = { key = key, hwid = SDK.hwid() }
	if type(target) == "number" then q.place = target else q.id = target end
	local status, body = get("/script", q)
	if status ~= 200 then
		local ok, data = pcall(HttpService.JSONDecode, HttpService, body)
		return false, ok and data.code or "NETWORK_ERROR"
	end
	local fn, err = loadstring(body)
	if not fn then return false, err end
	return true, fn()
end

function SDK.kick(reason)
	game:GetService("Players").LocalPlayer:Kick("[Stealth X] " .. tostring(reason))
end

-- Catat launch (beat=true = heartbeat, cuma update status online)
function SDK.track(key, placeId, name, beat)
	pcall(get, "/track", {
		key = key, hwid = SDK.hwid(), place = placeId, name = name,
		exec = SDK.executor(), beat = beat and 1 or nil,
	})
end

function SDK.heartbeat(key, placeId, name)
	SDK.track(key, placeId, name)
	task.spawn(function()
		while task.wait(60) do SDK.track(key, placeId, name, true) end
	end)
end

return SDK
