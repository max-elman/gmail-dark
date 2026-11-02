// Only job: pass the keyboard shortcut to the Gmail tab that's in front.

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-dark') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {
    // Not a Gmail tab (no content script there): nothing to toggle.
  });
});
