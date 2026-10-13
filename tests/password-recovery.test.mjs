import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Password Recovery Email Validation & User Enumeration Protection', () => {
  function validateResetEmail(email) {
    if (!email || typeof email !== 'string') return false
    const trimmed = email.trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  }

  function getResetPasswordResponse(_email, errorFromProvider = null) {
    // If rate-limited, provide friendly rate-limiting message
    if (
      errorFromProvider &&
      (errorFromProvider.message.includes('rate limit') ||
        errorFromProvider.message.includes('too many requests'))
    ) {
      return {
        success: false,
        message: 'Too many requests. Please wait before requesting another reset email.',
      }
    }

    // Always return generic success message to prevent user enumeration
    return {
      success: true,
      message: 'If an account exists with that email, password reset instructions have been sent.',
    }
  }

  test('validates standard email addresses', () => {
    assert.equal(validateResetEmail('producer@muzico.test'), true)
    assert.equal(validateResetEmail('alex.producer@studio.domain.com'), true)
    assert.equal(validateResetEmail('USER@DOMAIN.COM'), true)
  })

  test('rejects malformed or empty email addresses', () => {
    assert.equal(validateResetEmail(''), false)
    assert.equal(validateResetEmail(null), false)
    assert.equal(validateResetEmail('plainaddress'), false)
    assert.equal(validateResetEmail('@missingusername.com'), false)
    assert.equal(validateResetEmail('missing.domain@'), false)
  })

  test('returns generic message for both existing and non-existing accounts', () => {
    const existingUserResp = getResetPasswordResponse('realuser@domain.com', null)
    const nonExistingUserResp = getResetPasswordResponse('unknown@domain.com', {
      message: 'User not found',
    })

    assert.equal(existingUserResp.message, nonExistingUserResp.message)
    assert.equal(
      existingUserResp.message,
      'If an account exists with that email, password reset instructions have been sent.'
    )
  })

  test('safely handles rate limit feedback without leaking account state', () => {
    const rateLimitResp = getResetPasswordResponse('anyone@domain.com', {
      message: 'Email rate limit exceeded',
    })
    assert.equal(rateLimitResp.success, false)
    assert.match(rateLimitResp.message, /too many requests/i)
  })
})

describe('Auth Callback URL Sanitization & Open Redirect Prevention', () => {
  function sanitizeRedirectUrl(rawNext) {
    if (!rawNext || typeof rawNext !== 'string') return '/'
    // Must start with '/' and must NOT start with '//' (protocol-relative URL)
    if (rawNext.startsWith('/') && !rawNext.startsWith('//')) {
      return rawNext
    }
    return '/'
  }

  test('allows safe relative local paths', () => {
    assert.equal(sanitizeRedirectUrl('/'), '/')
    assert.equal(sanitizeRedirectUrl('/reset-password'), '/reset-password')
    assert.equal(sanitizeRedirectUrl('/onboarding'), '/onboarding')
    assert.equal(sanitizeRedirectUrl('/artists?view=all'), '/artists?view=all')
  })

  test('blocks absolute external redirect URLs', () => {
    assert.equal(sanitizeRedirectUrl('https://evil.com'), '/')
    assert.equal(sanitizeRedirectUrl('http://phishing-site.test/login'), '/')
    assert.equal(sanitizeRedirectUrl('javascript:alert(1)'), '/')
  })

  test('blocks protocol-relative URLs (open redirect bypass vector)', () => {
    assert.equal(sanitizeRedirectUrl('//evil.com'), '/')
    assert.equal(sanitizeRedirectUrl('///evil.com/path'), '/')
    assert.equal(sanitizeRedirectUrl('//google.com'), '/')
  })

  test('defaults to / on empty or invalid inputs', () => {
    assert.equal(sanitizeRedirectUrl(''), '/')
    assert.equal(sanitizeRedirectUrl(null), '/')
    assert.equal(sanitizeRedirectUrl(undefined), '/')
  })
})

describe('Password Reset Form Validation', () => {
  function validateNewPassword(password, confirmPassword) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' }
    }
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long.' }
    }
    if (password !== confirmPassword) {
      return { valid: false, error: 'Passwords do not match. Please try again.' }
    }
    return { valid: true }
  }

  test('accepts matching passwords with 8+ characters', () => {
    const result = validateNewPassword('SecurePass123!', 'SecurePass123!')
    assert.equal(result.valid, true)
    assert.equal(result.error, undefined)
  })

  test('rejects passwords shorter than 8 characters', () => {
    const result = validateNewPassword('short1', 'short1')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Password must be at least 8 characters long.')
  })

  test('rejects mismatched passwords', () => {
    const result = validateNewPassword('SecurePass123!', 'DifferentPass123!')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Passwords do not match. Please try again.')
  })

  test('rejects empty passwords', () => {
    const result = validateNewPassword('', '')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Password is required')
  })
})

describe('Supabase Auth Callback Flow Detection (PKCE code vs. TokenHash)', () => {
  function determineVerificationStrategy(params) {
    const code = params.get('code')
    const tokenHash = params.get('token_hash')
    const type = params.get('type')

    if (code) {
      return { strategy: 'exchangeCodeForSession', code }
    }
    if (tokenHash && type) {
      return { strategy: 'verifyOtp', tokenHash, type }
    }
    return { strategy: 'invalid' }
  }

  function resolveCallbackNextTarget(params) {
    const type = params.get('type')
    const defaultNext = type === 'recovery' ? '/reset-password' : '/'
    const rawNext = params.get('next') ?? defaultNext
    return rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  }

  test('detects PKCE code flow generated by {{ .ConfirmationURL }}', () => {
    const params = new URLSearchParams('code=pkce_auth_code_12345&next=/onboarding')
    const flow = determineVerificationStrategy(params)
    assert.equal(flow.strategy, 'exchangeCodeForSession')
    assert.equal(flow.code, 'pkce_auth_code_12345')
  })

  test('detects TokenHash OTP flow generated by {{ .TokenHash }} for email confirmation', () => {
    const params = new URLSearchParams('token_hash=th_abc123xyz&type=signup')
    const flow = determineVerificationStrategy(params)
    assert.equal(flow.strategy, 'verifyOtp')
    assert.equal(flow.tokenHash, 'th_abc123xyz')
    assert.equal(flow.type, 'signup')
  })

  test('detects TokenHash recovery flow and auto-routes to /reset-password', () => {
    const params = new URLSearchParams('token_hash=th_rec987&type=recovery')
    const flow = determineVerificationStrategy(params)
    assert.equal(flow.strategy, 'verifyOtp')
    assert.equal(flow.tokenHash, 'th_rec987')
    assert.equal(flow.type, 'recovery')

    const nextTarget = resolveCallbackNextTarget(params)
    assert.equal(nextTarget, '/reset-password')
  })

  test('flags missing or malformed params as invalid strategy', () => {
    const emptyParams = new URLSearchParams('')
    assert.equal(determineVerificationStrategy(emptyParams).strategy, 'invalid')

    const missingTypeParams = new URLSearchParams('token_hash=th_no_type')
    assert.equal(determineVerificationStrategy(missingTypeParams).strategy, 'invalid')
  })
})
