// WorkStack Tab Tracker - Background Service Worker
// Tracks ONLY the currently active/visible tab
// Time is only counted when a tab is actually visible on screen

// State
let isTracking = false
let isPaused = false
let userId = null
let authToken = null
let apiBaseUrl = 'http://localhost:3000'
let hasSavedSession = false

// Track the currently active tab (only ONE tab at a time)
let currentTabId = null
let currentTabStartTime = null

// Track all tabs with their accumulated times
let tabTimes = new Map() // tabId -> { url, title, domain, totalTime, lastSyncTime }

// Initialize from storage
chrome.storage.local.get(['isTracking', 'isPaused', 'userId', 'authToken', 'apiBaseUrl', 'savedSessionTabs'], (result) => {
  if (result.isTracking) isTracking = result.isTracking
  if (result.isPaused) isPaused = result.isPaused
  if (result.userId) userId = result.userId
  if (result.authToken) authToken = result.authToken
  if (result.apiBaseUrl) apiBaseUrl = result.apiBaseUrl
  hasSavedSession = result.savedSessionTabs && result.savedSessionTabs.length > 0
})

// Helper: Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (e) {
    return url
  }
}

// Helper: Check if URL is a special page
function isSpecialUrl(url) {
  return !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('file://')
}

// Helper: Get active tabs as array
function getActiveTabsArray() {
  return Array.from(tabTimes.values()).map(tab => ({
    url: tab.url,
    title: tab.title,
    domain: tab.domain,
    duration_seconds: Math.floor(tab.totalTime / 1000),
    started_at: new Date(tab.firstSeen).toISOString()
  }))
}

// Sync the current tab's time to server
function syncCurrentTabTime() {
  if (!currentTabId || !currentTabStartTime) return

  const tabData = tabTimes.get(currentTabId)
  if (!tabData) return

  const now = Date.now()
  const sessionTime = now - currentTabStartTime
  tabData.totalTime += sessionTime
  tabData.lastSyncTime = now
  currentTabStartTime = now

  // Send to server
  upsertTabToServer(tabData.url, tabData.title, tabData.domain, Math.floor(tabData.totalTime / 1000))
}

// Sync a specific tab's time (for when switching away or closing)
function syncTabTime(tabId) {
  const tabData = tabTimes.get(tabId)
  if (!tabData) return

  const now = Date.now()
  // Calculate time since last sync
  const timeSinceLastSync = tabData.lastSyncTime ? (now - tabData.lastSyncTime) : 0
  tabData.totalTime += timeSinceLastSync
  tabData.lastSyncTime = now

  upsertTabToServer(tabData.url, tabData.title, tabData.domain, Math.floor(tabData.totalTime / 1000))
}

// Start tracking a new tab as the active one
function makeTabActive(tab) {
  if (isSpecialUrl(tab.url)) return

  // First, sync the previous active tab if there was one
  if (currentTabId && currentTabId !== tab.id) {
    syncCurrentTabTime()
  }

  const domain = extractDomain(tab.url)
  const now = Date.now()

  // Check if we already have this tab tracked
  if (tabTimes.has(tab.id)) {
    const existing = tabTimes.get(tab.id)
    // Update URL/title if changed
    existing.url = tab.url
    existing.title = tab.title || tab.url
    existing.domain = domain
    existing.lastSyncTime = now
  } else {
    // New tab
    tabTimes.set(tab.id, {
      url: tab.url,
      title: tab.title || tab.url,
      domain: domain,
      totalTime: 0,
      firstSeen: now,
      lastSyncTime: now
    })
  }

  // This is now the active tab
  currentTabId = tab.id
  currentTabStartTime = now

  console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] Active tab:`, tab.url)
}

// Stop tracking a tab (when it's closed)
function stopTrackingTab(tabId) {
  if (tabId === currentTabId) {
    syncCurrentTabTime()
    currentTabId = null
    currentTabStartTime = null
  }

  // Remove from tracked tabs
  const tabData = tabTimes.get(tabId)
  if (tabData) {
    // Final sync before removing
    const wasCurrent = tabId === currentTabId
    if (!wasCurrent) {
      syncTabTime(tabId)
    }
    tabTimes.delete(tabId)
    console.log('Tab closed:', tabData.url)
  }
}

// Listen for messages from website
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTracking') {
    startTracking(request.userId, request.authToken, request.apiBaseUrl)
    sendResponse({ success: true })
  } else if (request.action === 'stopTracking') {
    stopTracking()
    sendResponse({ success: true })
  } else if (request.action === 'pauseTracking') {
    pauseTracking()
    sendResponse({ success: true })
  } else if (request.action === 'resumeTracking') {
    resumeTracking()
    sendResponse({ success: true })
  } else if (request.action === 'resumeActivity') {
    resumeActivity()
    sendResponse({ success: true })
  } else if (request.action === 'openSavedTabs') {
    openSavedTabs()
    sendResponse({ success: true })
  } else if (request.action === 'getStatus') {
    const tabs = getActiveTabsArray()
    sendResponse({
      isTracking,
      isPaused,
      hasSavedSession,
      sessionTabs: tabs
    })
    return true
  } else if (request.action === 'ping') {
    sendResponse({ success: true, version: '3.1.0' })
  } else if (request.action === 'openUrls') {
    openUrls(request.urls)
    sendResponse({ success: true })
  } else if (request.action === 'storeAuthToken') {
    authToken = request.authToken
    apiBaseUrl = request.apiBaseUrl || apiBaseUrl
    chrome.storage.local.set({ authToken, apiBaseUrl })
    sendResponse({ success: true })
  } else if (request.action === 'getOpenTabs') {
    chrome.tabs.query({}, (allTabs) => {
      const tabs = allTabs
        .filter(tab => tab.url && !isSpecialUrl(tab.url))
        .map(tab => ({
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl
        }))
      sendResponse({ tabs })
    })
    return true
  }
  return true
})

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      isTracking,
      isPaused,
      hasSavedSession,
      sessionTabs: getActiveTabsArray()
    })
    return true
  } else if (request.action === 'pauseTracking') {
    pauseTracking()
    sendResponse({ success: true })
  } else if (request.action === 'resumeTracking') {
    resumeTracking()
    sendResponse({ success: true })
  } else if (request.action === 'resumeActivity') {
    resumeActivity()
    sendResponse({ success: true })
  } else if (request.action === 'openSavedTabs') {
    openSavedTabs()
    sendResponse({ success: true })
  } else if (request.action === 'toggleTracking') {
    if (isTracking) {
      stopTracking()
    } else {
      startTracking()
    }
    sendResponse({ success: true, isTracking })
  } else if (request.action === 'storeAuthToken') {
    authToken = request.authToken
    apiBaseUrl = request.apiBaseUrl || apiBaseUrl
    chrome.storage.local.set({ authToken, apiBaseUrl })
    sendResponse({ success: true })
  }
  return true
})

function startTracking(newUserId, newAuthToken, newApiBaseUrl) {
  if (newUserId) userId = newUserId
  if (newAuthToken) authToken = newAuthToken
  if (newApiBaseUrl) apiBaseUrl = newApiBaseUrl

  isTracking = true
  isPaused = false

  chrome.storage.local.set({
    isTracking,
    userId,
    authToken,
    apiBaseUrl
  })

  chrome.action.setBadgeText({ text: 'ON' })
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })

  // Clear existing data
  clearTrackedActivity()
  tabTimes.clear()
  currentTabId = null
  currentTabStartTime = null

  // Track the currently active tab immediately
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && !isSpecialUrl(tabs[0].url)) {
      makeTabActive(tabs[0])
    }
  })

  console.log('Tracking started - only active tab is tracked')
}

function stopTracking() {
  // Final sync before stopping
  syncCurrentTabTime()

  isTracking = false
  isPaused = false

  // Save current tabs for resume
  const currentTabs = getActiveTabsArray()
  if (currentTabs.length > 0) {
    hasSavedSession = true
    chrome.storage.local.set({
      savedSessionTabs: currentTabs,
      savedSessionAt: new Date().toISOString()
    })
  } else {
    hasSavedSession = false
  }

  currentTabId = null
  currentTabStartTime = null
  tabTimes.clear()

  chrome.storage.local.set({ isTracking: false, isPaused: false })
  chrome.action.setBadgeText({ text: '' })

  console.log('Tracking stopped')
}

function pauseTracking() {
  // Sync current tab before pausing
  syncCurrentTabTime()

  isPaused = true
  chrome.storage.local.set({ isPaused: true })
  chrome.action.setBadgeText({ text: 'PAUSED' })
  chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
  console.log('Tracking paused')
}

function resumeTracking() {
  isPaused = false
  chrome.storage.local.set({ isPaused: false })
  chrome.action.setBadgeText({ text: 'ON' })
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })

  // Track the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && !isSpecialUrl(tabs[0].url)) {
      makeTabActive(tabs[0])
    }
  })

  console.log('Tracking resumed')
}

function resumeActivity() {
  chrome.storage.local.get(['savedSessionTabs', 'userId', 'authToken', 'apiBaseUrl'], (result) => {
    const savedTabs = result.savedSessionTabs || []

    userId = result.userId
    authToken = result.authToken
    if (result.apiBaseUrl) apiBaseUrl = result.apiBaseUrl

    isTracking = true
    isPaused = false

    chrome.storage.local.set({ isTracking, isPaused: false })
    chrome.action.setBadgeText({ text: 'ON' })
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })

    if (savedTabs.length > 0) {
      const uniqueUrls = [...new Set(savedTabs.map(tab => tab.url))]
      chrome.windows.create({ url: uniqueUrls, focused: true })
      console.log('Activity resumed with', uniqueUrls.length, 'tabs')
    }
  })
}

function openSavedTabs() {
  chrome.storage.local.get(['savedSessionTabs'], (result) => {
    const savedTabs = result.savedSessionTabs || []
    if (savedTabs.length === 0) return

    const uniqueUrls = [...new Set(savedTabs.map(tab => tab.url))]
    chrome.windows.create({ url: uniqueUrls, focused: true })
    console.log('Opening', uniqueUrls.length, 'saved tabs')
  })
}

function openUrls(urls) {
  if (!urls || urls.length === 0) return
  const uniqueUrls = [...new Set(urls)]
  chrome.windows.create({ url: uniqueUrls, focused: true })
  console.log('Opening', uniqueUrls.length, 'tabs from collection')
}

// Upsert tab to server
function upsertTabToServer(url, title, domain, durationSeconds) {
  if (!authToken || !userId) return

  const data = JSON.stringify({
    user_id: userId,
    url,
    title,
    domain,
    duration_seconds: durationSeconds,
    started_at: new Date().toISOString()
  })

  fetch(`${apiBaseUrl}/api/activity/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: data
  }).catch(err => console.error('Failed to upsert tab:', err))
}

// Remove tab from server
function removeTabFromServer(url) {
  if (!authToken || !userId) return

  fetch(`${apiBaseUrl}/api/activity/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      user_id: userId,
      url
    })
  }).catch(err => console.error('Failed to remove tab:', err))
}

// Clear all tracked activity for this user
function clearTrackedActivity() {
  if (!authToken || !userId) return

  fetch(`${apiBaseUrl}/api/activity/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ user_id: userId })
  }).catch(err => console.error('Failed to clear activity:', err))
}

// ========== EVENT LISTENERS ==========

// When tab is activated (switched to) - THIS IS THE KEY EVENT
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isTracking || isPaused) return

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && !isSpecialUrl(tab.url)) {
      makeTabActive(tab)
    }
  } catch (error) {
    console.error('Error on tab activated:', error)
  }
})

// When tab is updated (URL changes or page loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isTracking || isPaused) return
  if (isSpecialUrl(tab.url)) return

  // Only care if this is the current active tab
  if (tabId !== currentTabId) return

  // If URL changed or page is loading, update our tracking
  if (changeInfo.status === 'loading' || changeInfo.url) {
    makeTabActive(tab)
  }
})

// When tab is removed (closed)
chrome.tabs.onRemoved.addListener((tabId) => {
  if (!isTracking || isPaused) return
  stopTrackingTab(tabId)
})

// When window is focused (user switches back to browser)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!isTracking || isPaused || windowId === chrome.windows.WINDOW_ID_NONE) return

  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs[0] && tabs[0].url && !isSpecialUrl(tabs[0].url)) {
      makeTabActive(tabs[0])
    }
  })
})

// Sync time to server every 10 seconds (only for the active tab)
setInterval(() => {
  if (isTracking && !isPaused && currentTabId) {
    syncCurrentTabTime()
  }
}, 10000)

// On extension startup - clear stale data
chrome.runtime.onStartup.addListener(() => {
  if (userId && authToken) {
    clearTrackedActivity()
  }
})

chrome.runtime.onInstalled.addListener(() => {
  console.log('WorkStack Tab Tracker v3.1.0 installed - Active tab tracking mode')
})
