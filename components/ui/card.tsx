import React from 'react'

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style, ...props }: CardProps) {
  return (
    <div
      className={`rounded-md border transition-all duration-300 ${className}`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(59, 130, 246, 0.1)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 border-b ${className}`} style={{ borderColor: 'var(--border-color)' }}>{children}</div>
}

export function CardContent({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`p-5 ${className}`} style={{ pointerEvents: 'auto', ...style }}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 border-t ${className}`} style={{ borderColor: 'var(--border-color)' }}>{children}</div>
}
