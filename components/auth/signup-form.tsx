'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { markUserSignedIn } from '@/lib/guest-storage'
import { GoogleSignInButton } from './google-signin-button'

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

  // Email already exists
  if (message.includes('User already registered') || message.includes('already registered') || message.includes('duplicate')) {
    return 'An account with this email already exists. Try signing in instead.'
  }

  // Invalid email format
  if (message.includes('Invalid email')) {
    return 'Please enter a valid email address.'
  }

  // Password too short
  if (message.includes('Password should be at least') || message.includes('password is too short')) {
    return 'Password must be at least 6 characters long.'
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

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string; requirements: { text: string; met: boolean }[] } {
  if (!password) {
    return {
      score: 0,
      label: '',
      color: '#e5e7eb',
      requirements: [
        { text: 'At least 6 characters', met: false },
        { text: 'Contains uppercase letter', met: false },
        { text: 'Contains lowercase letter', met: false },
        { text: 'Contains number', met: false },
        { text: 'Contains special character', met: false }
      ]
    }
  }

  let score = 0
  const requirements = [
    { text: 'At least 6 characters', met: password.length >= 6 },
    { text: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { text: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { text: 'Contains number', met: /\d/.test(password) },
    { text: 'Contains special character', met: /[^a-zA-Z0-9]/.test(password) }
  ]

  const metCount = requirements.filter(r => r.met).length

  if (password.length >= 10) score++
  if (password.length >= 12) score++
  if (metCount >= 4) score++
  if (metCount === 5) score++

  const normalizedScore = Math.min(score, 5)

  let label = ''
  let color = ''

  if (metCount === 0) {
    label = ''
    color = '#e5e7eb'
  } else if (metCount <= 2) {
    label = 'Weak'
    color = '#ef4444'
  } else if (metCount === 3) {
    label = 'Fair'
    color = '#f97316'
  } else if (metCount === 4) {
    label = 'Good'
    color = '#eab308'
  } else {
    label = 'Strong'
    color = '#22c55e'
  }

  return { score: normalizedScore, label, color, requirements }
}

interface SignupFormProps {
  onToggleLogin?: () => void
}

export function SignupForm({ onToggleLogin }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Terms of Service checkbox
  const [agreeToTerms, setAgreeToTerms] = useState(false)

  // Email validation state
  const [emailTouched, setEmailTouched] = useState(false)
  const emailValid = isValidEmail(email)

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!agreeToTerms) {
      setError('Please agree to Terms of Service to continue.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
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

  const handleEmailBlur = () => {
    setEmailTouched(true)
  }

  return (
    <>
      <form onSubmit={handleSignup} className="space-y-4">
        {/* Name input with icon */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-label="Your name"
            autoComplete="name"
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: error ? '#ef4444' : 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Email input with icon and validation */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <label htmlFor="signup-email" className="sr-only">Email address</label>
          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
            required
            aria-label="Email address"
            aria-invalid={emailTouched && !emailValid ? 'true' : 'false'}
            aria-describedby={emailTouched && !emailValid ? 'signup-email-error' : undefined}
            autoComplete="email"
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: error ? '#ef4444' : (emailTouched && !emailValid ? '#f97316' : 'var(--border-color)'),
              color: 'var(--text-primary)'
            }}
          />
          {emailTouched && !emailValid && (
            <p id="signup-email-error" className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#f97316' }}>
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
          <label htmlFor="signup-password" className="sr-only">Password</label>
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            aria-label="Password"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={password ? 'password-strength' : undefined}
            autoComplete="new-password"
            className="w-full pl-12 pr-14 py-3.5 rounded-xl border-2 focus:outline-none transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: error ? '#ef4444' : 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
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

        {/* Password strength indicator */}
        {password && (
          <div className="space-y-3 p-4 rounded-xl" id="password-strength" role="status" aria-live="polite" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Password strength</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: passwordStrength.label ? 'white' : 'var(--text-secondary)', backgroundColor: passwordStrength.label ? passwordStrength.color : 'transparent' }}>
                {passwordStrength.label || 'Start typing'}
              </span>
            </div>
            <div className="flex gap-1.5 mb-3" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className="h-1.5 flex-1 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: level <= passwordStrength.score
                      ? passwordStrength.color
                      : 'var(--border-color)'
                  }}
                />
              ))}
            </div>

            {/* Password requirements */}
            <div className="space-y-1.5">
              {passwordStrength.requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 text-xs" style={{ color: req.met ? '#22c55e' : 'var(--text-secondary)' }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: req.met ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-color)' }}>
                    {req.met ? (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  <span>{req.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms of Service checkbox */}
        <div className="flex items-start gap-3">
          <div className="relative pt-0.5">
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              required
              aria-required="true"
              className="w-5 h-5 rounded-lg border-2 cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: agreeToTerms ? '#8b5cf6' : 'var(--bg-secondary)',
                borderColor: error && !agreeToTerms ? '#ef4444' : 'var(--border-color)'
              }}
            />
          </div>
          <label htmlFor="agree-terms" className="text-xs cursor-pointer flex-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            I agree to the{' '}
            <button
              type="button"
              className="underline hover:opacity-80 transition-all font-medium"
              style={{ color: '#8b5cf6' }}
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              type="button"
              className="underline hover:opacity-80 transition-all font-medium"
              style={{ color: '#8b5cf6' }}
            >
              Privacy Policy
            </button>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl" role="alert" aria-live="assertive" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1.5px solid rgba(239, 68, 68, 0.3)' }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#ef4444" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm" style={{ color: '#ef4444' }}>{error}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !agreeToTerms || !emailValid || password.length < 6}
          aria-busy={loading}
          className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: 'white',
            cursor: (loading || !agreeToTerms || !emailValid || password.length < 6) ? 'not-allowed' : 'pointer',
            opacity: (loading || !agreeToTerms || !emailValid || password.length < 6) ? 0.6 : 1,
            boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.25)'
          }}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Already have an account link */}
      {onToggleLogin && (
        <div className="text-center py-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onToggleLogin}
              className="text-sm font-medium hover:underline transition-all"
              style={{ color: '#8b5cf6', cursor: 'pointer' }}
            >
              Sign in
            </button>
          </span>
        </div>
      )}

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
        mode="signup"
        onError={setError}
      />
    </>
  )
}
