// background/background.js
import { getTabsData, saveTabsData, updateTab, removeTab } from './storage.js';

// Init script - clean up storage compared to currently open tabs
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Tab Intelligence Engine Installed');
  await syncWithOpenTabs();
});

// Sync tracking with currently active tabs
async function syncWithOpenTabs() {
  const currentTabs = await chrome.tabs.query({});
  const existingData = await getTabsData();
  
  const newData = {};
  const now = Date.now();
  
  currentTabs.forEach(tab => {
    // Keep existing data, or create new initial tracking data
    newData[tab.id] = existingData[tab.id] || {
      id: tab.id,
      url: tab.url || '',
      domain: new URL(tab.url || 'http://unknown').hostname,
      title: tab.title || '',
      createdTime: now,
      lastVisited: tab.active ? now : 0,
      visitCount: tab.active ? 1 : 0,
      activityScore: 0, 
      pinned: tab.pinned
    };
  });
  
  await saveTabsData(newData);
}

// Track when a tab is activated (switched to)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(tabId);
  const now = Date.now();
  
  const tabData = await getTabsData();
  if (tabData[tabId]) {
    tabData[tabId].lastVisited = now;
    tabData[tabId].visitCount = (tabData[tabId].visitCount || 0) + 1;
    await saveTabsData(tabData);
  } else {
    // Edge case if a tab somehow misses creation
    await updateTab(tabId, {
      id: tab.id,
      url: tab.url,
      domain: new URL(tab.url || 'http://unknown').hostname,
      title: tab.title,
      createdTime: now,
      lastVisited: now,
      visitCount: 1,
      activityScore: 0,
      pinned: tab.pinned
    });
  }
});

// Track when a tab changes (e.g. finishes loading a new URL)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateTab(tabId, {
      url: tab.url,
      domain: new URL(tab.url || 'http://unknown').hostname,
      title: tab.title,
      pinned: tab.pinned
    });
  }
});

// Handle tab closure
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTab(tabId);
});

// Listen for activity from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'PAGE_ACTIVITY' && sender.tab) {
    handlePageActivity(sender.tab.id, message.payload);
  }
});

async function handlePageActivity(tabId, activity) {
  const tabData = await getTabsData();
  if (tabData[tabId]) {
    // Simple naive score bumps for activity (scrolls + clicks + keypresses)
    const bump = (activity.scrolls * 0.1) + (activity.clicks * 1) + (activity.keys * 0.5);
    tabData[tabId].activityScore = (tabData[tabId].activityScore || 0) + bump;
    
    // Cap activity score to avoid runaway values from single endless sessions
    if (tabData[tabId].activityScore > 100) tabData[tabId].activityScore = 100;
    
    // FOCUS GRAVITY: Active tab drains life from inactive tabs
    const drainAmount = bump * 0.25; // 25% gravitational drain rate
    if (drainAmount > 0) {
      Object.keys(tabData).forEach(id => {
        // Drain all other tabs except pinned ones
        if (id !== String(tabId) && tabData[id] && !tabData[id].pinned) {
          tabData[id].activityScore = (tabData[id].activityScore || 0) - drainAmount;
          // Floor the drain at -50 so inactive tabs take a massive hit but don't go to negative infinity
          if (tabData[id].activityScore < -50) tabData[id].activityScore = -50;
        }
      });
    }

    await saveTabsData(tabData);
  }
}
