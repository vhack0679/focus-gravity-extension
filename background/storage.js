// background/storage.js
// Handles communication with chrome.storage.local for storing tab data

export const StorageArea = chrome.storage.local;

// Structure of tabs data in storage:
// "tabs_data": {
//    [tabId]: { url, domain, title, lastVisited, visitCount, activityScore, createdTime }
// }

export async function getTabsData() {
  const result = await StorageArea.get(['tabs_data']);
  return result.tabs_data || {};
}

export async function saveTabsData(tabsData) {
  await StorageArea.set({ tabs_data: tabsData });
}

export async function getTab(tabId) {
  const data = await getTabsData();
  return data[tabId];
}

export async function updateTab(tabId, updates) {
  const data = await getTabsData();
  if (data[tabId]) {
    data[tabId] = { ...data[tabId], ...updates };
  } else {
    data[tabId] = updates;
  }
  await saveTabsData(data);
}

export async function removeTab(tabId) {
  const data = await getTabsData();
  if (data[tabId]) {
    delete data[tabId];
    await saveTabsData(data);
  }
}

export async function clearAll() {
  await StorageArea.clear();
}
