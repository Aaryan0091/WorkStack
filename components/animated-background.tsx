'use client'

import { useEffect, useRef } from 'react'

export function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create multiple blob elements
    const blobs = [
      { color: 'var(--color-teal)', size: 400, duration: 10, delay: 0 },
      { color: 'var(--color-purple)', size: 350, duration: 12, delay: -5 },
      { color: 'var(--color-pink)', size: 300, duration: 15, delay: -10 },
      { color: 'var(--color-amber)', size: 380, duration: 11, delay: -15 },
      { color: 'var(--color-sky)', size: 320, duration: 14, delay: -8 },
    ]

    blobs.forEach((blob) => {
      const blobEl = document.createElement('div')
      blobEl.className = 'animated-blob'
      blobEl.style.cssText = `
        background: ${blob.color};
        width: ${blob.size}px;
        height: ${blob.size}px;
        animation-duration: ${blob.duration}s;
        animation-delay: ${blob.delay}s;
        top: ${Math.random() * 80}%;
        left: ${Math.random() * 80}%;
      `
      container.appendChild(blobEl)
    })

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{
        backgroundColor: 'var(--bg-primary)',
      }}
    />
  )
}
