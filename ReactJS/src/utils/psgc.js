const PSGC_V2_BASE_URL = 'https://psgc.cloud/api/v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CITIES_CACHE_KEY = 'psgc_v2_cities_only_v1';
const BARANGAYS_CACHE_PREFIX = 'psgc_v2_barangays_v1_';

function safeNow() {
  return Date.now();
}

function safeReadCache(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || !Number.isFinite(parsed.savedAt)) return null;
    if (safeNow() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function safeWriteCache(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: safeNow(),
        data,
      })
    );
  } catch {
    // Ignore storage failures (private mode/quota exceeded).
  }
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function fetchRows(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`PSGC request failed (${res.status})`);
  }
  const json = await res.json();
  return extractRows(json);
}

export function normalizePsgcName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function formatDisplayLocalityName(name) {
  const normalized = normalizePsgcName(name);
  const lowered = normalized.toLowerCase();
  if (lowered.startsWith('city of ')) {
    const core = normalized.slice(8).trim();
    if (core) return `${core} City`;
  }
  return normalized;
}

function buildNameAliases(name) {
  const normalized = normalizePsgcName(name);
  const aliases = new Set();
  if (!normalized) return [];

  const lowered = normalized.toLowerCase();
  aliases.add(lowered);

  if (lowered.startsWith('city of ')) {
    const core = normalizePsgcName(normalized.slice(8)).toLowerCase();
    if (core) {
      aliases.add(core);
      aliases.add(`${core} city`);
    }
  }

  if (lowered.endsWith(' city')) {
    const core = normalizePsgcName(normalized.slice(0, -5)).toLowerCase();
    if (core) {
      aliases.add(core);
      aliases.add(`city of ${core}`);
    }
  }

  const displayName = formatDisplayLocalityName(normalized).toLowerCase();
  aliases.add(displayName);

  return Array.from(aliases).filter(Boolean);
}

export function findPsgcByName(list, name) {
  const target = normalizePsgcName(name).toLowerCase();
  if (!target) return null;
  return (
    (list || []).find((item) => {
      const aliases = Array.isArray(item?.name_aliases) ? item.name_aliases : [];
      if (aliases.includes(target)) return true;
      return normalizePsgcName(item?.name).toLowerCase() === target;
    }) || null
  );
}

export async function loadPsgcCities() {
  const cached = safeReadCache(CITIES_CACHE_KEY);
  if (cached) return cached;

  const rows = await fetchRows(`${PSGC_V2_BASE_URL}/cities-municipalities`);
  const mapped = rows
    .map((row) => ({
      code: String(row?.code || '').trim(),
      name: normalizePsgcName(row?.name),
      display_name: formatDisplayLocalityName(row?.name),
      name_aliases: buildNameAliases(row?.name),
      type: normalizePsgcName(row?.type),
      locality_kind: String(row?.type || '').toLowerCase() === 'city' ? 'city' : 'municipality',
      province: normalizePsgcName(row?.province),
      region: normalizePsgcName(row?.region),
    }))
    .filter((row) => row.code && row.name && row.locality_kind === 'city')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  safeWriteCache(CITIES_CACHE_KEY, mapped);
  return mapped;
}

export async function loadPsgcBarangaysByCityCode(cityCode) {
  const code = String(cityCode || '').trim();
  if (!code) return [];

  const cacheKey = `${BARANGAYS_CACHE_PREFIX}${code}`;
  const cached = safeReadCache(cacheKey);
  if (cached) return cached;

  const rows = await fetchRows(`${PSGC_V2_BASE_URL}/cities-municipalities/${encodeURIComponent(code)}/barangays`);
  const mapped = rows
    .map((row) => ({
      code: String(row?.code || '').trim(),
      name: normalizePsgcName(row?.name),
    }))
    .filter((row) => row.code && row.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  safeWriteCache(cacheKey, mapped);
  return mapped;
}
