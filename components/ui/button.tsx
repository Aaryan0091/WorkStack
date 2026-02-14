import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const variantStyles: Record<string, string> = {
    primary: '',
    secondary: '',
    ghost: '',
    danger: '',
  }

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const getVariantStyle = (variant: string): React.CSSProperties => {
    if (variant === 'primary') {
      return {
        backgroundColor: 'var(--color-primary)',
        color: 'white'
      }
    }
    if (variant === 'secondary') {
      return {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)'
      }
    }
    if (variant === 'ghost') {
      return {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)'
      }
    }
    if (variant === 'danger') {
      return {
        backgroundColor: 'var(--color-danger)',
        color: 'white'
      }
    }
    return {}
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={getVariantStyle(variant)}
      {...props}
    >
      {children}
    </button>
  )
}
