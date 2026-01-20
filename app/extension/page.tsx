'use client'

import { useEffect, useState } from 'react'
import { getBrowser, isChromiumBased, getBrowserName } from '@/lib/browser-detect'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function ExtensionPage() {
  const [browser, setBrowser] = useState<string>('')
  const [supported, setSupported] = useState<boolean | null>(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBrowser(getBrowserName())
    setSupported(isChromiumBased())
  }, [])

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Download WorkStack Extension
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Install the browser extension to enable activity tracking features.
          </p>
        </div>

        {/* Browser compatibility warning - only show after mount to avoid hydration mismatch */}
        {mounted && !supported && (
          <div className="mb-6 p-4 rounded-lg border-2" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b' }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold" style={{ color: '#b45309' }}>Browser Not Supported</h3>
                <p className="text-sm mt-1" style={{ color: '#b45309' }}>
                  You are currently using <strong>{browser}</strong>. The WorkStack extension requires a Chromium-based browser (Chrome, Edge, or Brave).
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl shadow-lg p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Browser Compatibility
          </h2>

          {/* Compatibility Matrix */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm" style={{ color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th className="text-left py-2 px-3">Browser</th>
                  <th className="text-center py-2 px-3">Extension</th>
                  <th className="text-left py-2 px-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>🌐</span> Google Chrome
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#22c55e' }}>✓ Full Support</span></td>
                  <td className="py-2 px-3">Recommended</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>📘</span> Microsoft Edge
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#22c55e' }}>✓ Full Support</span></td>
                  <td className="py-2 px-3">Chromium-based</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>🦁</span> Brave
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#22c55e' }}>✓ Full Support</span></td>
                  <td className="py-2 px-3">May need to adjust shields</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>🦊</span> Firefox
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#ef4444' }}>✗ Not Compatible</span></td>
                  <td className="py-2 px-3">Different extension API</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>🧭</span> Safari
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#ef4444' }}>✗ Not Compatible</span></td>
                  <td className="py-2 px-3">Different extension architecture</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span>📱</span> Mobile Browsers
                  </td>
                  <td className="text-center py-2 px-3"><span style={{ color: '#f59e0b' }}>⚠️ Limited</span></td>
                  <td className="py-2 px-3">Use desktop for full features</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Installation Instructions
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Step 1: Locate Extension Files
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                The extension files are in the <code className="bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded">workstack-extension</code> folder alongside this project.
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Step 2: Install Extension
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Open your browser and navigate to extensions page:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Chrome: <code className="bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded text-xs">chrome://extensions/</code></li>
                    <li>Edge: <code className="bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded text-xs">edge://extensions/</code></li>
                    <li>Brave: <code className="bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded text-xs">brave://extensions/</code></li>
                  </ul>
                </li>
                <li>Enable "Developer mode" (toggle in top right)</li>
                <li>Click "Load unpacked" button</li>
                <li>Select the <code className="bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded">workstack-extension</code> folder</li>
              </ol>
            </div>

            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Features
              </h3>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>✓ Track your browsing activity and time spent on tabs</li>
                <li>✓ Save bookmarks directly from any webpage</li>
                <li>✓ Resume your previous browsing session with one click</li>
                <li>✓ All data stored privately in your WorkStack account</li>
              </ul>
            </div>

            {mounted && supported && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                <h3 className="font-semibold mb-1" style={{ color: '#15803d' }}>
                  ✓ Good News!
                </h3>
                <p className="text-sm" style={{ color: '#15803d' }}>
                  You're using <strong>{browser}</strong> which is fully supported!
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
