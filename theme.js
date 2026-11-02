// Shared by the content script and the popup: preferences and the
// "should Gmail be dark right now?" decision.

const GDM_DEFAULTS = {
  enabled: true,
  mode: 'system', // 'light' | 'dark' | 'system' | 'schedule' | 'sun'
  darkFrom: '20:00',
  darkUntil: '07:00',
  lat: null,
  lng: null,
  softness: 0.9, // contrast applied on top of the inversion; 1 = pure black/white
  hide: {}, // per Gmail account: { 'me@example.com': { logo: true, streak: true } }
};

async function gdmLoadPrefs() {
  const { prefs } = await chrome.storage.sync.get('prefs');
  return { ...GDM_DEFAULTS, ...(prefs || {}) };
}

async function gdmSavePrefs(changes) {
  const prefs = { ...(await gdmLoadPrefs()), ...changes };
  await chrome.storage.sync.set({ prefs });
  return prefs;
}

function gdmMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// True when `now` falls in [from, until), wrapping past midnight if needed.
function gdmInRange(now, from, until) {
  const t = now.getHours() * 60 + now.getMinutes();
  const a = gdmMinutes(from);
  const b = gdmMinutes(until);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

// Sunrise and sunset for the local day containing `date`, computed on-device
// (no network). Follows the approach of the suncalc library (BSD-2).
// Returns { sunrise, sunset } as Dates, or { polar: 'day' | 'night' }.
function gdmSunTimes(date, lat, lng) {
  const rad = Math.PI / 180;
  const dayMs = 86400000;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const J0 = 0.0009;
  const e = rad * 23.4397;

  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const d = noon.valueOf() / dayMs - 0.5 + J1970 - J2000;

  const lw = rad * -lng;
  const phi = rad * lat;
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const transit = (x) => J2000 + x + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const jNoon = transit(ds);

  const h0 = rad * -0.833; // sun's upper edge at the horizon, with refraction
  const cosW = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1) return { polar: 'day' };
  if (cosW > 1) return { polar: 'night' };

  const w = Math.acos(cosW);
  const jSet = transit(J0 + (w + lw) / (2 * Math.PI) + n);
  const jRise = jNoon - (jSet - jNoon);
  const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
  return { sunrise: fromJulian(jRise), sunset: fromJulian(jSet) };
}

function gdmShouldBeDark(prefs, now, systemDark) {
  if (!prefs.enabled) return false;
  switch (prefs.mode) {
    case 'dark':
      return true;
    case 'light':
      return false;
    case 'system':
      return systemDark;
    case 'sun':
      if (prefs.lat != null && prefs.lng != null) {
        const sun = gdmSunTimes(now, prefs.lat, prefs.lng);
        if (sun.polar) return sun.polar === 'night';
        return now < sun.sunrise || now >= sun.sunset;
      }
      // No location saved yet: fall back to the clock schedule.
      return gdmInRange(now, prefs.darkFrom, prefs.darkUntil);
    case 'schedule':
      return gdmInRange(now, prefs.darkFrom, prefs.darkUntil);
    default:
      return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { GDM_DEFAULTS, gdmInRange, gdmSunTimes, gdmShouldBeDark };
}
