'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { markUserSignedIn } from '@/lib/guest-storage'
import { GoogleSignInButton } from './google-signin-button'
import { getExtensionId } from '@/lib/extension-detect'

// Type for Chrome runtime message response
interface ChromeMessageResponse {
  success?: boolean
  [key: string]: unknown
}

// Extended Window interface for Chrome
interface ChromeWindow extends Window {
  chrome?: {
    runtime?: {
      sendMessage?: (
        extensionId: string,
        message: Record<string, unknown>,
        callback?: (response: ChromeMessageResponse) => void
      ) => void
      lastError?: { message?: string }
      id?: string
    }
  }
}

// Helper function to get user-friendly error messages
function getAuthErrorMessage(error: Error | { message?: string }): string {
  const message = error.message || ''

  // Email not confirmed
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link to verify your account.'
  }

  // Invalid login credentials
  if (message.includes('Invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }

  // Email already exists (for signup context)
  if (message.includes('User already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }

  // Invalid email format
  if (message.includes('Invalid email')) {
    return 'Please enter a valid email address.'
  }

  // Password too short
  if (message.includes('Password should be at least')) {
    return 'Password is too short. Please use a stronger password.'
  }

  // Rate limited
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  // Default error message
  return message || 'An error occurred. Please try again.'
}

// Email validation function
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Email validation state
  const [emailTouched, setEmailTouched] = useState(false)
  const emailValid = isValidEmail(email)

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')

  // Store auth token in extension after login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { access_token?: string } | null) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
        const apiBaseUrl = window.location.origin
        const chromeWindow = window as ChromeWindow

        if (chromeWindow.chrome?.runtime) {
          const extensionId = getExtensionId()
          if (!extensionId) {
            return
          }

          let responded = false
          const timeout = setTimeout(() => {
            if (!responded) {
              responded = true
            }
          }, 500)

          chromeWindow.chrome.runtime.sendMessage?.(extensionId, {
            action: 'storeAuthToken',
            authToken: session.access_token,
            apiBaseUrl
          }, () => {
            if (responded) return
            responded = true
            clearTimeout(timeout)

            if (chromeWindow.chrome?.runtime?.lastError) {
              // Extension not installed or not reachable - silently ignore
            }
          })
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      markUserSignedIn()
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      const errorMessage = getAuthErrorMessage(err as Error | { message: string })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setResetSuccess(true)
      setResetEmail('')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setResetError(errorMessage)
    } finally {
      setResetLoading(false)
    }
  }

  const handleEmailBlur = () => {
    setEmailTouched(true)
  }

  return (
    <div className="space-y-4">
      {!showForgotPassword ? (
        <>
          <form onSubmit={handleLogin} className="space-y-4" aria-label="Sign in form">
            {/* Email input with icon and validation */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
                aria-required="true"
                autoComplete="email"
                aria-invalid={emailTouched && !emailValid ? 'true' : 'false'}
                aria-describedby={emailTouched && !emailValid ? 'email-error' : undefined}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: error ? '#ef4444' : (emailTouched && !emailValid ? '#f97316' : 'var(--border-color)'),
                  color: 'var(--text-primary)'
                }}
              />
              {emailTouched && !emailValid && (
                <p id="email-error" className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#f97316' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.932-3.13L12.067 5.784c-1.123-1.463-3.074-1.463-4.197 0L3.135 10.37c-.57 1.463.393 3.13 1.932 3.13h5.56v5.563c0 1.54 1.667 2.502 3.13 1.932l6.69-5.164c1.123-1.463 1.123-3.074 0-4.537l-6.69-5.164c-1.463-.57-3.13.393-3.13 1.932v5.563h-5.56z" />
                  </svg>
                  Please enter a valid email address
                </p>
              )}
            </div>

            {/* Password input with icon and show/hide */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                autoComplete="current-password"
                className="w-full pl-12 pr-14 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: error ? '#ef4444' : 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                id="toggle-password"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200 hover:scale-110"
                style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Forgot password link */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true)
                  setError('')
                }}
                className="text-sm font-medium hover:underline transition-all"
                style={{ color: '#8b5cf6', cursor: 'pointer' }}
              >
                Forgot password?
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl" role="alert" aria-live="polite" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1.5px solid rgba(239, 68, 68, 0.3)' }}>
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#ef4444" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm" style={{ color: '#ef4444' }}>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !emailValid}
              aria-busy={loading}
              className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                cursor: (loading || !emailValid) ? 'not-allowed' : 'pointer',
                opacity: (loading || !emailValid) ? 0.6 : 1,
                boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.25)'
              }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-3">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
            <span className="px-4 text-xs" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              Or continue with
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
          </div>

          {/* Google Sign In Button */}
          <GoogleSignInButton
            mode="signin"
            onError={setError}
          />
        </>
      ) : (
        /* Forgot Password Form */
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)' }}>
              <svg className="w-7 h-7" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Reset your password
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {!resetSuccess ? (
            <>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {/* Email input for password reset */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <label htmlFor="reset-email" className="sr-only">Email address</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    aria-required="true"
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: resetError ? '#ef4444' : 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                {/* Error message */}
                {resetError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl" role="alert" aria-live="polite" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1.5px solid rgba(239, 68, 68, 0.3)' }}>
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#ef4444" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm" style={{ color: '#ef4444' }}>{resetError}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={resetLoading || !isValidEmail(resetEmail)}
                  aria-busy={resetLoading}
                  className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    cursor: (resetLoading || !isValidEmail(resetEmail)) ? 'not-allowed' : 'pointer',
                    opacity: (resetLoading || !isValidEmail(resetEmail)) ? 0.6 : 1,
                    boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.25)'
                  }}
                >
                  {resetLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send reset link</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Cancel button */}
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setResetError('')
                }}
                className="w-full py-3.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to sign in</span>
              </button>
            </>
          ) : (
            /* Success message */
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl" role="status" aria-live="polite" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1.5px solid rgba(34, 197, 94, 0.3)' }}>
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="#22c55e" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-sm font-semibold block" style={{ color: '#22c55e' }}>Check your inbox</span>
                  <span className="text-sm block mt-1" style={{ color: 'var(--text-secondary)' }}>
                    We&apos;ve sent a password reset link to your email. It may take a moment to arrive.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setResetSuccess(false)
                }}
                className="w-full py-3.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to sign in</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
