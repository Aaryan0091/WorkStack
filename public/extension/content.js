// WorkStack Extension Content Script
  // This script runs on workstack pages to enable communication between the page and extension

  (function() {
    'use strict'

    // Get extension ID
    var extensionId = null
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      extensionId = chrome.runtime.id
    }

    // Listen for requests from the page
    window.addEventListener('message', function(event) {
      // Only accept messages from same origin
      if (event.source !== window) return

      if (event.data && event.data.type === 'workstack-request-extension-id') {
        // Send back the extension ID
        window.postMessage({
          type: 'workstack-extension-id-response',
          extensionId: extensionId
        }, '*')
      }
    })

    // Announce extension presence on page load
    function announceExtension() {
      window.postMessage({
        type: 'workstack-extension-installed',
        extensionId: extensionId
      }, '*')
    }

    // Announce immediately
    announceExtension()

    // Also announce when DOM is ready (in case we were too early)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', announceExtension)
    }
  })()