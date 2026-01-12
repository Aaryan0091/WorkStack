import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div
      className={`rounded-lg shadow-sm border ${className}`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
        ...style
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 border-b ${className}`} style={{ borderColor: 'var(--border-color)' }}>{children}</div>
}

export function CardContent({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`p-6 ${className}`} style={{ pointerEvents: 'auto', ...style }}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 border-t ${className}`} style={{ borderColor: 'var(--border-color)' }}>{children}</div>
}
