// popup/popup.js
import { getTabsData, saveTabsData, removeTab } from '../background/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  await renderUI();
  
  // Set up Focus Mode toggle
  document.getElementById('focusModeToggle').addEventListener('change', async (e) => {
    // Focus mode logic to be implemented next
    if (e.target.checked) {
      await enableFocusMode();
    } else {
      await disableFocusMode();
    }
  });

  // Bulk close low priority
  document.getElementById('closeLowPriorityBtn').addEventListener('click', async () => {
    const tabsData = await getTabsData();
    const scoredTabs = await computeScores(tabsData);
    const lowPriority = scoredTabs.filter(t => t.priority === 'LOW');
    
    for (const t of lowPriority) {
      if (!t.pinned) {
        chrome.tabs.remove(t.id).catch(err => console.error("Tab already closed", err));
        await removeTab(t.id);
      }
    }
    await renderUI();
  });
});

async function renderUI() {
  const tabsData = await getTabsData();
  const scoredTabs = await computeScores(tabsData);

  document.getElementById('totalTabs').textContent = scoredTabs.length;
  
  const highPriority = scoredTabs.filter(t => t.priority === 'HIGH');
  const lowPriority = scoredTabs.filter(t => t.priority === 'LOW');
  
  document.getElementById('lowPriorityTabs').textContent = lowPriority.length;

  renderList('highPriorityList', highPriority);
  renderList('lowPriorityList', lowPriority);
  
  // Group tabs that are High or Medium priority (ignore Low since they should be closed)
  const groups = buildGroups(scoredTabs.filter(t => t.priority !== 'LOW'));
  renderGroups('groupList', groups);
}

function renderList(elementId, tabs) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = '';
  
  if (tabs.length === 0) {
    ul.innerHTML = '<li class="tab-item"><div class="tab-info"><div class="tab-title" style="color:var(--text-muted)">None found</div></div></li>';
    return;
  }

  tabs.forEach(tab => {
    const li = document.createElement('li');
    li.className = 'tab-item';
    li.innerHTML = `
      <img class="tab-icon" src="https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32" alt="">
      <div class="tab-info">
        <div class="tab-title" title="${tab.title}">${tab.title}</div>
        <div class="tab-meta">
          <span class="score-badge ${tab.priority === 'HIGH' ? 'score-high' : 'score-low'}">Score: ${Math.round(tab.score)}</span>
          <span>${formatTimeDiff(tab.lastVisited)}</span>
        </div>
      </div>
      <button class="close-tab-btn" data-id="${tab.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
    
    // Switch to tab on click
    li.addEventListener('click', (e) => {
      if(!e.target.closest('.close-tab-btn')) {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });

    // Close tab action
    li.querySelector('.close-tab-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id).catch(() => {});
      removeTab(tab.id);
      li.remove();
    });

    ul.appendChild(li);
  });
}

function renderGroups(elementId, groups) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = '';
  
  if (Object.keys(groups).length === 0) {
    ul.innerHTML = '<li class="tab-item"><div class="tab-info"><div class="tab-title" style="color:var(--text-muted)">No groups needed</div></div></li>';
    return;
  }

  Object.keys(groups).forEach(domain => {
    const groupTabs = groups[domain];
    const li = document.createElement('li');
    li.className = 'tab-item';
    li.style.flexDirection = 'column';
    li.style.alignItems = 'stretch';
    
    // Header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="tab-info">
        <div class="tab-title">📂 ${domain} (${groupTabs.length} tabs)</div>
        <div class="tab-meta">Focus Gravity grouped - Click to view</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="native-group-btn" title="Create Chrome Tab Group">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
        </button>
        <div class="group-arrow">▼</div>
      </div>
    `;

    // Dropdown Container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'group-children';

    groupTabs.forEach(tab => {
        const childLi = document.createElement('div');
        childLi.className = 'tab-item';
        childLi.style.padding = '6px';
        childLi.style.background = 'var(--bg-dark)';
        childLi.innerHTML = `
          <img class="tab-icon" src="https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32" alt="">
          <div class="tab-info">
            <div class="tab-title" style="font-size:0.75rem" title="${tab.title}">${tab.title}</div>
            <div class="tab-meta" style="font-size:0.6rem">
              <span class="${tab.priority === 'HIGH' ? 'score-high' : 'score-low'}">Score: ${Math.round(tab.score)}</span>
            </div>
          </div>
          <button class="close-tab-btn" data-id="${tab.id}">✕</button>
        `;
        
        // Jump to tab
        childLi.addEventListener('click', (e) => {
          if(!e.target.closest('.close-tab-btn')) {
            chrome.tabs.update(tab.id, { active: true });
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });

        // Close logic
        childLi.querySelector('.close-tab-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          chrome.tabs.remove(tab.id).catch(() => {});
          await removeTab(tab.id);
          childLi.remove();
        });
        
        childrenContainer.appendChild(childLi);
    });

    // Expand / Collapse
    header.addEventListener('click', () => {
        header.classList.toggle('expanded');
        childrenContainer.classList.toggle('expanded');
    });

    // Native Browser Group Creation
    header.querySelector('.native-group-btn').addEventListener('click', async (e) => {
      e.stopPropagation(); // prevent accordion
      const tabIds = groupTabs.map(t => t.id);
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title: domain });
      } catch (err) {
        console.error("Failed to create native Chrome tab group", err);
      }
    });

    li.appendChild(header);
    li.appendChild(childrenContainer);
    ul.appendChild(li);
  });
}

// Basic grouping by domain
function buildGroups(tabs) {
  const groups = {};
  tabs.forEach(tab => {
    if (!groups[tab.domain]) groups[tab.domain] = [];
    groups[tab.domain].push(tab);
  });
  // Only return domains with > 1 tab
  const validGroups = {};
  Object.keys(groups).forEach(k => {
    if (groups[k].length > 1) validGroups[k] = groups[k];
  });
  return validGroups;
}

// MVP Heuristic Scoring Engine
async function computeScores(tabsData) {
  const chromeTabs = await chrome.tabs.query({});
  const now = Date.now();
  
  const scored = chromeTabs.map(tab => {
    const data = tabsData[tab.id] || { lastVisited: now, visitCount: 1, activityScore: 0 };
    
    let score = 50; // baseline
    
    // 1. Time since last visit decay
    const hoursSinceVisit = (now - data.lastVisited) / (1000 * 60 * 60);
    if (hoursSinceVisit < 1) score += 20; // Active recently
    else if (hoursSinceVisit > 24) score -= 30; // Stale
    else if (hoursSinceVisit > 72) score -= 50; // Very stale
    
    // 2. Visit frequency
    if (data.visitCount > 10) score += 20;
    else if (data.visitCount > 3) score += 10;
    
    // 3. Activity Level (scrolls, clicks)
    score += Math.min(30, data.activityScore || 0); // Cap boost at 30
    
    // 4. Domain type heuristics (Simple dictionary for now)
    const domain = new URL(tab.url || 'http://unknown').hostname;
    if (domain.includes('youtube.com') || domain.includes('twitter.com') || domain.includes('reddit.com')) {
      // Social/Media domains drain score faster if inactive, but boost high if actively using
      if (hoursSinceVisit > 2) score -= 20;
    } else if (domain.includes('github.com') || domain.includes('docs.')) {
      // Work docs retain value a bit longer
      if (hoursSinceVisit < 24) score += 10;
    }
    
    if (tab.pinned) score += 100; // Pinned tabs are always high priority
    if (tab.active) score = 100; // Currently active tab is max priority

    // Compute Bucket
    let priority = 'MEDIUM';
    if (score >= 70) priority = 'HIGH';
    else if (score < 30) priority = 'LOW';
    
    return {
      id: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      domain: domain,
      title: tab.title,
      score: score,
      priority: priority,
      lastVisited: data.lastVisited,
      pinned: tab.pinned,
      active: tab.active
    };
  });
  
  return scored.sort((a, b) => b.score - a.score);
}

function formatTimeDiff(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHrs > 0) return `${diffHrs}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

async function enableFocusMode() {
  const tabsData = await getTabsData();
  const scoredTabs = await computeScores(tabsData);
  
  // Hide (or actually suspend/group) low and medium tabs, keep only the high-priority ones visible
  // For Chrome extensions, we can group them and collapse the group, or move them to another window.
  // Grouping and collapsing is best for Focus Mode.
  
  const toHide = scoredTabs.filter(t => t.priority !== 'HIGH' && !t.active);
  if (toHide.length > 0) {
    const tabIds = toHide.map(t => t.id);
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: "Hidden (Focus Mode)", color: "grey", collapsed: true });
    } catch(err) {
      console.log("Groups not supported or error", err);
    }
  }
}

async function disableFocusMode() {
  // Ungroup "Hidden" tabs if we wanted to toggle off.
  // We'd query the specific group we created and ungroup.
  // This is a simplified version:
  const groups = await chrome.tabGroups.query({ title: "Hidden (Focus Mode)" });
  for (const g of groups) {
    const tabsInGroup = await chrome.tabs.query({ groupId: g.id });
    const tabIds = tabsInGroup.map(t => t.id);
    if(tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
    }
  }
}
