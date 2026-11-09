# Gmail Dark

A small Chrome extension that puts Gmail and Google Drive in dark mode. It can follow your Mac's light/dark setting, a schedule, or sunset and sunrise. It makes no network requests: sunrise and sunset are calculated in the browser, and settings are kept in Chrome's synced storage.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this `gmail-dark` folder.
4. Reload any open Gmail and Drive tabs.
5. Pin it from the puzzle-piece menu to reach the settings.

After editing a file, click the reload arrow on the extension's card, then reload Gmail and Drive.

### On another computer

1. `gh repo clone max-elman/gmail-dark ~/Developer/gmail-dark` (or `git clone https://github.com/max-elman/gmail-dark.git ~/Developer/gmail-dark`)
2. Load that folder unpacked as above.
3. To update later: `git -C ~/Developer/gmail-dark pull`, then click the reload arrow on the extension's card.

The `key` in `manifest.json` gives the extension the same ID (`agmgabijcnpddgdoaekjhkejbhoklfgk`) on every computer, so your settings follow you through Chrome sync. Don't remove it. Its private half is `~/.gmail-dark-extension-key.pem` on the MacBook and is only needed to pack the extension as a `.crx` or upload it to the Chrome Web Store.

## Settings (toolbar icon)

- **On/off switch** at the top.
- **When to go dark:** Match my Mac, Always dark, Always light, On a schedule (to the minute, works across midnight), or Sunset to sunrise ("Use my location", or type latitude and longitude). Without a location, sunset mode uses the schedule hours.
- **Label colors:** labels keep the colors you picked, except Gmail's default light gray, which turns dark so it doesn't show as bright pills.
- **Softness:** how gray the dark background is. The default (since 1.2) is about Gmail's own dark gray (#1f1f1f); all the way right is pure black, further left is lighter gray. Text is brightened back so it stays near white. Photos get the same small contrast drop. Gmail photo themes are replaced at night by a plain gray picked so every themed account ends up the same dark gray (about #222) at any softness, and read rows lose the dark stripe some themes give them.
- **On this account** (shows when the popup is opened on a Gmail tab or another Google app): hide the Workspace logo box next to your picture (your organization's logo, or a blank white box when none is set) along with the pill outline around it, and (in Gmail) hide Streak's top-bar button and Gmail's Studio, Ask Gemini and Support buttons. These are saved per Google account and apply in light and dark mode. The logo setting covers every Google app on google.com (Calendar, Drive, Docs, Sheets, Slides, Meet, Chat, Keep and so on). Hiding Streak only hides its button; the Streak extension still runs.
- **Shortcut:** ⌥⇧D (Option+Shift+D) switches between dark and light. Change it at `chrome://extensions/shortcuts`.

## How it works

- `dark.css` inverts Gmail's page (`invert(1) hue-rotate(180deg)`) while `html[data-gdm-theme="dark"]` is set, then inverts images, video and canvas back so photos look normal.
- Gmail photo themes: at night the photo is replaced with plain dark gray. `content.js` tags any image (or CSS background) covering most of the window with `data-gdm-backdrop`. Over a photo, Gmail draws the top bar and rail icons light, which inversion would make dark on dark. So when the top bar's text color is light, `content.js` marks the page `data-gdm-light-frame` and `dark.css` flips the top bar (`data-gdm-banner`) and the left sidebar (`data-gdm-nav`) back, plus the right rail's icon pictures (`data-gdm-icon`). Solid light buttons in the sidebar, like Compose, are flipped once more (`data-gdm-unflip`) so they stay dark. When the sidebar opens on hover, its see-through panel (`data-gdm-panel`) gets a solid dark gray background; this is rechecked on hover in and out. The search box is toned down to a faint lift while you're not typing in it.
- Label colors: Gmail sets each label's color inline. `content.js` tags those chips in the inbox and sidebar `data-gdm-keep`, and `dark.css` flips them back so they show the colors you picked. Plain white or black backgrounds are skipped, so buttons inside emails stay dark.
- Other Google apps (any `*.google.com` page besides Gmail and Drive): `content.js` also runs there, but only for the logo hiding. They have their own dark themes, so this extension doesn't darken them and the shortcut does nothing there.
- Per-account hiding: `content.js` reads the account from the avatar's label, tags the logo box beside the avatar (`data-gdm-hide`) and Streak's top-bar button (`data-gdm-hide-streak`, found by its InboxSDK class or "Streak" label), and `dark.css` hides them.
- All of this is rechecked every 5 seconds while dark, since Gmail redraws the list and rails as you move around.
- `content.js` runs before Gmail draws, decides light or dark with `theme.js`, sets that attribute, and checks again every minute, when you return to the tab, when your Mac's setting changes, and when you change a setting.
- Drive gets the same page inversion and logo-box hiding. The Gmail-only fixes (photo themes, light top bar, label chips, Streak) are skipped there, so a full-window file preview isn't mistaken for a photo theme.
- `background.js` only passes the keyboard shortcut to the Gmail or Drive tab.
- `popup.*` is the settings panel.

## Known limits

- Colors in HTML emails are inverted, not redesigned, so branded newsletters can look off.
- If Gmail's or Drive's own dark theme is turned on, this flips it back to light. Use their default (light) theme with it.
- "Use my location" needs Location Services turned on for Chrome in macOS System Settings → Privacy & Security.

## License

MIT. See `LICENSE`.
