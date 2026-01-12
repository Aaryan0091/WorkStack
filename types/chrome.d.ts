// Chrome Extension API types
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage(
          extensionId: string,
          message: any,
          callback?: (response: any) => void
        ): void
        lastError?: { message: string }
      }
    }
  }
}

// TypeScript workaround for chrome.runtime in external messaging
declare const chrome: {
  runtime: {
    sendMessage(
      extensionId: string,
      message: any,
      callback?: (response: any) => void
    ): void
    lastError?: { message: string }
  }
}

export {}
