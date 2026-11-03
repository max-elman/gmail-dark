// Runs on Gmail at document_start, so the theme is set before the page paints.
// Also runs on the other Google apps (Calendar, Drive, Docs, Meet...), which
// have their own dark mode: there it only hides the logo box by the avatar.

(() => {
  const root = document.documentElement;
  const hideOnly = location.hostname !== 'mail.google.com';
  const systemQuery = matchMedia('(prefers-color-scheme: dark)');
  let prefs = { ...GDM_DEFAULTS };

  // A Gmail photo theme is a big image behind everything. Re-inverted like any
  // other photo it stays bright, so tag it and dark.css replaces it at night.
  function isBackdrop(el) {
    const r = el.getBoundingClientRect();
    return r.width >= innerWidth * 0.6 && r.height >= innerHeight * 0.6;
  }

  function markBackdrops() {
    if (!document.body) return;
    for (const img of document.body.getElementsByTagName('img')) {
      if (!img.hasAttribute('data-gdm-backdrop') && isBackdrop(img)) {
        img.setAttribute('data-gdm-backdrop', '');
      }
    }
    // Some themes are a CSS background on an empty element. Look at what sits
    // under a few edge points, where the theme shows around the inbox.
    const points = [
      [4, innerHeight - 4],
      [innerWidth - 4, innerHeight - 4],
      [innerWidth / 2, innerHeight - 4],
      [innerWidth - 4, innerHeight / 2],
    ];
    for (const [x, y] of points) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el === document.body || el === root) break;
        if (el.childElementCount === 0 && !el.hasAttribute('data-gdm-backdrop') &&
            getComputedStyle(el).backgroundImage.startsWith('url(') && isBackdrop(el)) {
          el.setAttribute('data-gdm-backdrop', '');
        }
      }
    }
  }

  function rgba(color) {
    const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) || []).map(Number);
    return { r, g, b, a };
  }

  function isLight(color) {
    const { r, g, b } = rgba(color);
    return 0.299 * r + 0.587 * g + 0.114 * b > 150;
  }

  // Over a photo theme Gmail draws its top bar, left sidebar and right rail
  // icons light (the sidebar opens as a dark see-through panel). The top bar's
  // text color tells us; dark.css then flips the top bar and sidebar back.
  // Inside the sidebar, solid light buttons such as Compose are flipped once
  // more so they stay dark like the rest of the page. In the right rail only
  // the small icon pictures are flipped, since its app icons are real images.
  function markLightFrame() {
    const banner = document.querySelector('header[role="banner"]');
    const light = !!banner && isLight(getComputedStyle(banner).color);
    root.toggleAttribute('data-gdm-light-frame', light);
    if (banner) {
      banner.toggleAttribute('data-gdm-banner', true);
      watchSearch(banner);
      for (const el of banner.querySelectorAll('*')) {
        el.toggleAttribute('data-gdm-unflip', light && isLightPopup(el));
      }
    }

    const nav = document.querySelector('[role="navigation"]');
    if (nav) {
      nav.toggleAttribute('data-gdm-nav', light);
      watchSidebarHover(nav);
      for (const el of [nav, ...nav.querySelectorAll('*')]) {
        el.toggleAttribute('data-gdm-unflip', light && el !== nav && isSolidLightButton(el));
        el.toggleAttribute('data-gdm-panel', light && isOpenSidebarPanel(el));
      }
    }

    for (const rail of document.querySelectorAll('[role="complementary"]')) {
      for (const el of rail.querySelectorAll('*')) {
        el.toggleAttribute('data-gdm-icon', light && isRailIcon(el, rail));
      }
    }
  }

  // When the sidebar opens, Gmail gives it a see-through background meant for
  // the photo, which comes out as a light gray slab. Tag that panel so dark.css
  // makes it solid dark. It only exists while open (on hover), so recheck then.
  function isOpenSidebarPanel(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 200) return false;
    if (el.parentElement?.closest('[data-gdm-panel]')) return false;
    // Read Gmail's own background, not our override (the caller re-tags).
    el.removeAttribute('data-gdm-panel');
    return rgba(getComputedStyle(el).backgroundColor).a > 0;
  }

  function watchSidebarHover(nav) {
    if (nav.hasAttribute('data-gdm-watched')) return;
    nav.setAttribute('data-gdm-watched', '');
    const recheck = () => [250, 600, 1200].forEach((ms) => setTimeout(fixIfDark, ms));
    nav.addEventListener('mouseenter', recheck);
    nav.addEventListener('mouseleave', recheck);
  }

  // Search suggestions open as a white panel. Inside the search box dark.css
  // handles it; this catches any such panel elsewhere in the top bar.
  function isLightPopup(el) {
    if (el.closest('form[role="search"]')) return false;
    if (el.parentElement?.closest('[data-gdm-unflip]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 300 || r.height < 100) return false;
    el.removeAttribute('data-gdm-unflip');
    const bg = getComputedStyle(el).backgroundColor;
    return rgba(bg).a >= 0.9 && isLight(bg);
  }

  function watchSearch(banner) {
    if (banner.hasAttribute('data-gdm-watched')) return;
    banner.setAttribute('data-gdm-watched', '');
    const recheck = () => [50, 300, 800].forEach((ms) => setTimeout(fixIfDark, ms));
    banner.addEventListener('focusin', recheck);
    banner.addEventListener('focusout', recheck);
  }

  function isSolidLightButton(el) {
    if (el.parentElement?.closest('[data-gdm-unflip]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false; // label color dots are smaller
    const bg = getComputedStyle(el).backgroundColor;
    return rgba(bg).a >= 0.9 && isLight(bg);
  }

  function isRailIcon(el, rail) {
    if (el.tagName === 'IMG') return false;
    const style = getComputedStyle(el);
    const pic = [style.backgroundImage, style.maskImage, style.webkitMaskImage];
    if (!pic.some((v) => v && v.startsWith('url('))) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.width > 48 || r.height > 48) return false;
    for (let p = el.parentElement; p && p !== rail; p = p.parentElement) {
      if (rgba(getComputedStyle(p).backgroundColor).a >= 0.5) return false;
    }
    return true;
  }

  // Label colors are set inline on small chips (inbox rows, left rail). The
  // page inversion would turn light labels dark and dark ones pale, so tag
  // them and dark.css flips them back to the colors you picked. Plain white
  // or black backgrounds (buttons inside emails) are left inverted.
  function markLabelColors() {
    const chips = document.querySelectorAll(
      '[role="main"] [style*="background-color"], [role="navigation"] [style*="background-color"]',
    );
    for (const el of chips) {
      el.toggleAttribute('data-gdm-keep', isLabelChip(el));
    }
  }

  function isLabelChip(el) {
    // Inside the flipped sidebar, labels already show their real colors.
    if (el.closest('[data-gdm-nav]')) return false;
    if (el.parentElement?.closest('[data-gdm-keep], [data-gdm-icon], [data-gdm-banner]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.width > 300 || r.height > 32) return false;
    const { r: red, g, b, a } = rgba(el.style.backgroundColor);
    if (a < 0.5) return false;
    const hi = Math.max(red, g, b);
    const lo = Math.min(red, g, b);
    return !(lo > 235 || hi < 20);
  }

  // The signed-in account, from the avatar link's label ("Google Account: Name
  // (me@example.com)"). Hiding choices in the popup are kept per account.
  function avatarLink() {
    return document.querySelector('header[role="banner"] a[aria-label^="Google Account"]') ||
      (hideOnly ? document.querySelector('a[aria-label^="Google Account"]') : null);
  }

  function accountEmail() {
    const label = avatarLink()?.getAttribute('aria-label') || '';
    return (label.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [''])[0].toLowerCase();
  }

  // On a Workspace account Gmail puts the organization's logo in the pill next
  // to the avatar, a blank white box when none is set. Tag what sits beside
  // the avatar link in that pill (pictures or small light boxes).
  function markLogoBox(on) {
    const avatar = avatarLink();
    if (!avatar) return;
    // The outlined pill around the logo and avatar (Workspace accounts only).
    let outline = null;
    for (let p = avatar.parentElement, i = 0; p && p !== document.body && i < 6 && p.getAttribute('role') !== 'banner'; p = p.parentElement, i++) {
      const style = getComputedStyle(p);
      if (parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== 'none') {
        outline = p;
        break;
      }
    }
    let pill = outline || avatar.parentElement;
    for (let i = 0; !outline && pill && i < 3 && pill.childElementCount < 2; i++) pill = pill.parentElement;
    if (!pill) return;

    const hide = new Set();
    for (const el of pill.querySelectorAll('*')) {
      if (el === avatar || avatar.contains(el) || el.contains(avatar) || !isLogo(el)) continue;
      // Take the logo's own wrappers too, so no empty space is left behind.
      let box = el;
      while (box.parentElement !== pill && box.parentElement.childElementCount === 1) box = box.parentElement;
      hide.add(box);
    }
    for (const el of pill.querySelectorAll('*')) el.toggleAttribute('data-gdm-hide', on && hide.has(el));
    document.querySelectorAll('[data-gdm-pill]').forEach((el) => el.removeAttribute('data-gdm-pill'));
    if (on && outline && hide.size) outline.setAttribute('data-gdm-pill', '');
  }

  function isLogo(el) {
    if (el.hasAttribute('data-gdm-hide')) return true; // hidden, so it measures 0
    if (el.parentElement?.closest('[data-gdm-hide]')) return false;
    if (el.querySelector('[data-gdm-hide]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.width > 140 || r.height > 48) return false;
    if (el.tagName === 'IMG') return true;
    const style = getComputedStyle(el);
    if (style.backgroundImage.startsWith('url(')) return true;
    const bg = style.backgroundColor;
    return rgba(bg).a >= 0.9 && isLight(bg) && r.width >= 16;
  }

  // Streak (built on InboxSDK) adds a button and a "Sign In" badge to the top
  // bar. Tag the smallest top-bar element that holds all of it.
  function markStreak(on) {
    const banner = document.querySelector('header[role="banner"]');
    if (!banner) return;
    banner.querySelectorAll('[data-gdm-hide-streak]').forEach((el) => el.removeAttribute('data-gdm-hide-streak'));
    if (!on) return;
    const hits = banner.querySelectorAll(
      '[class*="inboxsdk"], [class*="streak" i], [aria-label*="Streak" i], [data-tooltip*="Streak" i], img[src*="streak" i]',
    );
    for (const hit of hits) {
      if (!isStreakPart(hit)) continue;
      let box = hit;
      while (box.parentElement && box.parentElement !== banner && isStreakPart(box.parentElement)) {
        box = box.parentElement;
      }
      box.setAttribute('data-gdm-hide-streak', '');
    }
  }

  function isStreakPart(el) {
    const r = el.getBoundingClientRect();
    if (r.width > 260 || r.height > 64) return false;
    // Only Streak's own text: its name and the sign-in badge, nothing else.
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (text.replace(/streak|sign in|\d+/gi, '').trim()) return false;
    return !el.querySelector('a[aria-label^="Google Account"], form[role="search"]');
  }

  function markHidden() {
    const mine = prefs.hide?.[accountEmail()] || {};
    markLogoBox(!!mine.logo);
    if (!hideOnly) markStreak(!!mine.streak);
  }

  function fixPage() {
    markBackdrops();
    markLightFrame();
    markLabelColors();
  }

  function apply() {
    if (hideOnly) {
      markHidden();
      return;
    }
    const dark = gdmShouldBeDark(prefs, new Date(), systemQuery.matches);
    root.setAttribute('data-gdm-theme', dark ? 'dark' : 'light');
    root.style.setProperty('--gdm-softness', String(prefs.softness));
    if (dark) fixPage();
    markHidden();
  }

  async function reload() {
    prefs = await gdmLoadPrefs();
    apply();
  }

  reload();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.prefs) reload();
  });
  systemQuery.addEventListener('change', apply);

  // Schedules and sunset need a periodic re-check; once a minute is plenty.
  setInterval(apply, 60 * 1000);
  // Gmail loads its theme a few seconds in and redraws the rails and list as
  // you move around, so keep these fixes current while dark.
  const fixIfDark = () => {
    if (root.getAttribute('data-gdm-theme') === 'dark') fixPage();
    markHidden(); // the logo and Streak hiding applies in light mode too
  };
  [1, 3, 6, 10].forEach((s) => setTimeout(fixIfDark, s * 1000));
  setInterval(fixIfDark, 5 * 1000);
  addEventListener('resize', fixIfDark);
  addEventListener('hashchange', fixIfDark);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply();
  });

  // Keyboard shortcut (relayed by background.js): flip whatever is showing now.
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    // The popup asks which account this tab is, to show its hiding switches.
    if (message.type === 'account') {
      reply({
        email: accountEmail(),
        workspace: !!avatarLink() && !/@gmail\.com$/.test(accountEmail()),
        hideOnly,
      });
      return;
    }
    if (message.type !== 'toggle' || hideOnly) return;
    const isDark = root.getAttribute('data-gdm-theme') === 'dark';
    gdmSavePrefs({ enabled: true, mode: isDark ? 'light' : 'dark' });
  });
})();
