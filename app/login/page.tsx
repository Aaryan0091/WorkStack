'use client'

import { useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            WorkStack
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Your all-in-one productivity toolkit
          </p>
        </div>

        <div className="rounded-lg shadow-lg p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>

          {isLogin ? (
            <LoginForm onToggleMode={() => setIsLogin(false)} />
          ) : (
            <SignupForm onToggleMode={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  )
}
