// content/content.js
// Tracks user interaction within the page to measure "active usage"

let pageActivity = {
  scrolls: 0,
  clicks: 0,
  keys: 0
};

let syncInterval = null;

// Debounce helper
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
}

// Track Scroll
window.addEventListener('scroll', debounce(() => {
  pageActivity.scrolls++;
}, 200), { passive: true });

// Track Clicks
window.addEventListener('click', () => {
  pageActivity.clicks++;
}, { passive: true });

// Track Keypresses
window.addEventListener('keydown', debounce(() => {
  pageActivity.keys++;
}, 100), { passive: true });

// Sync activity back to background processing
function syncActivity() {
  if (pageActivity.scrolls > 0 || pageActivity.clicks > 0 || pageActivity.keys > 0) {
    
    // Safety check: if extension was reloaded, chrome.runtime & its methods get removed/invalidated
    if (!chrome.runtime || !chrome.runtime.sendMessage || !chrome.runtime.id) {
      clearInterval(syncInterval);
      return;
    }

    try {
      const p = chrome.runtime.sendMessage({
        type: 'PAGE_ACTIVITY',
        payload: { ...pageActivity }
      });
      
      if (p && p.catch) {
        p.catch(err => {
          if (err.message && err.message.includes("Extension context invalidated")) {
             clearInterval(syncInterval);
          }
        });
      }
    } catch (error) {
      // Catch synchronous errors if they escape
      if (error.message && error.message.includes("Extension context invalidated")) {
        clearInterval(syncInterval);
        return;
      }
    }
    
    // Reset after sync
    pageActivity.scrolls = 0;
    pageActivity.clicks = 0;
    pageActivity.keys = 0;
  }
}

// Send activity every 5 seconds if there's any
syncInterval = setInterval(syncActivity, 5000);

// Flush before leaving
window.addEventListener('beforeunload', syncActivity);
