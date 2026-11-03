const $ = (id) => document.getElementById(id);
const systemQuery = matchMedia('(prefers-color-scheme: dark)');

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function render(prefs) {
  lastPrefs = prefs;
  $('enabled').checked = prefs.enabled;
  document.body.classList.toggle('off', !prefs.enabled);
  document.querySelector(`input[name="mode"][value="${prefs.mode}"]`).checked = true;
  $('darkFrom').value = prefs.darkFrom;
  $('darkUntil').value = prefs.darkUntil;
  $('lat').value = prefs.lat ?? '';
  $('lng').value = prefs.lng ?? '';
  $('softness').value = prefs.softness;

  $('schedule').hidden = prefs.mode !== 'schedule';
  $('sun').hidden = prefs.mode !== 'sun';

  if (prefs.lat != null && prefs.lng != null) {
    const sun = gdmSunTimes(new Date(), prefs.lat, prefs.lng);
    $('sunTimes').textContent = sun.polar
      ? `No sunset today (polar ${sun.polar}).`
      : `Today: dark from ${fmtTime(sun.sunset)} until ${fmtTime(sun.sunrise)}.`;
  } else {
    $('sunTimes').textContent = 'No location yet. Until then it uses the schedule hours.';
  }

  const mine = prefs.hide?.[account?.email] || {};
  $('hideLogo').checked = !!mine.logo;
  $('hideStreak').checked = !!mine.streak;

  const dark = gdmShouldBeDark(prefs, new Date(), systemQuery.matches);
  $('status').textContent = `Gmail and Drive are ${dark ? 'dark' : 'light'} now`;
}

async function save(changes) {
  render(await gdmSavePrefs(changes));
}

function readCoord(id, limit) {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) && Math.abs(v) <= limit ? Math.round(v * 100) / 100 : null;
}

$('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', (e) => save({ mode: e.target.value }));
});
$('darkFrom').addEventListener('change', (e) => save({ darkFrom: e.target.value || '20:00' }));
$('darkUntil').addEventListener('change', (e) => save({ darkUntil: e.target.value || '07:00' }));
// 'change' (on release), not 'input': chrome.storage.sync limits writes per minute.
$('softness').addEventListener('change', (e) => save({ softness: parseFloat(e.target.value) }));
['lat', 'lng'].forEach((id) => {
  $(id).addEventListener('change', () => {
    save({ lat: readCoord('lat', 90), lng: readCoord('lng', 180) });
  });
});

$('locate').addEventListener('click', () => {
  $('locate').disabled = true;
  $('locateStatus').textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('locate').disabled = false;
      $('locateStatus').textContent = '';
      // Two decimals (about 1 km) is plenty for sunset times.
      save({
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lng: Math.round(pos.coords.longitude * 100) / 100,
      });
    },
    (err) => {
      $('locate').disabled = false;
      $('locateStatus').textContent =
        err.code === err.PERMISSION_DENIED
          ? 'Location is off for Chrome. Type it in instead.'
          : 'Couldn’t get a location. Type it in instead.';
    },
    { timeout: 10000, maximumAge: 3600000 },
  );
});

// Hiding is per Google account, so ask the open Gmail or Drive tab which one it is.
let account = null;
let lastPrefs = null;

async function findAccount() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const answer = await chrome.tabs.sendMessage(tab.id, { type: 'account' });
    if (!answer?.email) return;
    account = answer;
    $('accountEmail').textContent = account.email;
    $('hideLogoRow').hidden = !account.workspace;
    $('hideStreakRow').hidden = !account.gmail;
    $('account').hidden = false;
    if (lastPrefs) render(lastPrefs);
  } catch {
    // Not a Gmail or Drive tab (no content script to answer).
  }
}

async function saveHide(key, value) {
  if (!account?.email) return;
  const prefs = await gdmLoadPrefs();
  const hide = { ...(prefs.hide || {}) };
  const mine = { ...(hide[account.email] || {}), [key]: value };
  if (!mine.logo && !mine.streak) delete hide[account.email];
  else hide[account.email] = mine;
  save({ hide });
}

$('hideLogo').addEventListener('change', (e) => saveHide('logo', e.target.checked));
$('hideStreak').addEventListener('change', (e) => saveHide('streak', e.target.checked));

$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

chrome.commands?.getAll?.((commands) => {
  const cmd = commands.find((c) => c.name === 'toggle-dark');
  $('shortcutKey').textContent = cmd?.shortcut || 'not set';
});

gdmLoadPrefs().then(render);
findAccount();
