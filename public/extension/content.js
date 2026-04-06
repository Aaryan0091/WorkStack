// WorkStack Extension Content Script
// This script runs on workstack pages to enable communication between page and extension

(function() {
  'use strict'

  // Get extension ID
  var extensionId = null
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    extensionId = chrome.runtime.id
  }

  console.log('[WorkStack Extension] Content script loaded, ID:', extensionId, 'URL:', window.location.href)

  // Listen for requests from page
  window.addEventListener('message', function(event) {
    // Only accept messages from same origin
    if (event.source !== window) return

    if (event.data && event.data.type === 'workstack-request-extension-id') {
      console.log('[WorkStack Extension] Received extension ID request')
      // Send back extension ID
      window.postMessage({
        type: 'workstack-extension-id-response',
        extensionId: extensionId
      }, '*')
    }
  })

  // Announce extension presence immediately
  function announceExtension() {
    console.log('[WorkStack Extension] Announcing presence, ID:', extensionId)
    window.postMessage({
      type: 'workstack-extension-installed',
      extensionId: extensionId
    }, '*')
    window.dispatchEvent(new CustomEvent('workstack-extension-loaded', {
      detail: {
        installed: true,
        extensionId: extensionId
      }
    }))
  }

  // Announce immediately
  announceExtension()

  // Announce repeatedly to handle page transitions and re-renders
  setInterval(announceExtension, 2000)

  // Also announce when DOM is ready (in case we were too early)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announceExtension)
  }
})()
