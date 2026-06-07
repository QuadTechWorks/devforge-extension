// Service worker: handles omnibox keyword and keyboard shortcut

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Keyboard shortcut → open side panel
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-side-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Omnibox: "dt <text>" → run auto-detect and open panel with that text
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Store the pending auto-detect text so the panel can pick it up on open
  await chrome.storage.local.set({ _omniboxInput: text.trim(), _omniboxTimestamp: Date.now() });
  chrome.sidePanel.open({ tabId: tab.id });
});
