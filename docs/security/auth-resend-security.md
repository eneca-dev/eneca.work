# Auth Resend Endpoint Security Improvements

This document outlines the security improvements implemented for the `/api/auth/resend` endpoint to prevent abuse and enhance security.

## Overview

The auth resend endpoint (`/app/api/auth/resend/route.ts`) has been enhanced with multiple layers of security protection:

1. **Rate Limiting** - IP-based request throttling
2. **CAPTCHA Validation** - Server-side token verification
3. **Redirect URL Validation** - Whitelist-based URL validation
4. **Least-Privilege Client** - Switched from admin to server client
5. **Enhanced Monitoring** - Comprehensive logging and error tracking

## Security Features

### 1. Rate Limiting

- **Implementation**: IP-based rate limiting using in-memory store
- **Configuration**: 3 requests per 15 minutes per IP address
- **Headers**: Returns standard rate limit headers (`X-RateLimit-*`)
- **Response**: 429 status with retry-after information

```typescript
// Configuration in utils/rate-limiting.ts
export const EMAIL_RESEND_RATE_LIMIT: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // Maximum 3 resend requests per 15 minutes per IP
}
```

### 2. CAPTCHA Validation

- **Providers Supported**: hCaptcha and Cloudflare Turnstile
- **Server-Side Validation**: Tokens are validated against provider APIs
- **Configuration**: Enable by setting environment variables:
  - `HCAPTCHA_SECRET_KEY` for hCaptcha
  - `TURNSTILE_SECRET_KEY` for Turnstile
- **Optional**: CAPTCHA is only required when configured

### 3. Redirect URL Validation

- **Whitelist-Based**: Only allows pre-configured redirect URLs
- **Sources**: Environment variables and Supabase configuration
- **Validation**: Ensures redirect points to `/auth/callback` endpoint
- **Security**: Prevents open redirect vulnerabilities

### 4. Client Privilege Reduction

- **Before**: Used admin client with service role key
- **After**: Uses server client with anon key
- **Benefits**: Follows least-privilege principle
- **Compatibility**: `auth.resend` works with anon client

### 5. Enhanced Monitoring

- **Sentry Integration**: Comprehensive error tracking and performance monitoring
- **Security Events**: Logs rate limit violations, CAPTCHA failures, and redirect violations
- **Structured Logging**: Consistent logging format for security analysis

## Environment Configuration

### Required Variables

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: Site URL for redirect validation
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Optional: Additional allowed redirect URLs (comma-separated)
SUPABASE_ADDITIONAL_REDIRECT_URLS=https://app.yourdomain.com,https://staging.yourdomain.com
```

### Optional CAPTCHA Variables

```bash
# For hCaptcha
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret

# For Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your_turnstile_secret
```

## Frontend Integration

### Basic Request

```typescript
const response = await fetch('/api/auth/resend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com'
  })
})
```

### With CAPTCHA (when enabled)

```typescript
// After CAPTCHA completion
const response = await fetch('/api/auth/resend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    captchaToken: captchaToken // From hCaptcha or Turnstile
  })
})
```

### Handling Rate Limits

```typescript
const response = await fetch('/api/auth/resend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
})

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  console.log(`Rate limited. Retry after ${retryAfter} seconds`)
}
```

## Security Considerations

### Production Deployment

1. **Rate Limiting Storage**: Consider Redis for distributed rate limiting
2. **CAPTCHA Configuration**: Enable CAPTCHA in production environments
3. **Redirect URLs**: Maintain strict whitelist of allowed domains
4. **Monitoring**: Set up alerts for security events

### Monitoring & Alerts

Monitor these security events:
- Rate limit violations
- CAPTCHA validation failures
- Invalid redirect URL attempts
- Unusual request patterns

### Testing

1. **Rate Limiting**: Test with multiple requests from same IP
2. **CAPTCHA**: Test with invalid/missing tokens
3. **Redirect Validation**: Test with unauthorized URLs
4. **Client Permissions**: Verify anon client can perform resend operations

## Files Modified/Created

### New Security Utilities

- `utils/rate-limiting.ts` - IP-based rate limiting functionality
- `utils/captcha-validation.ts` - Server-side CAPTCHA validation
- `utils/redirect-validation.ts` - URL whitelist validation

### Modified Files

- `app/api/auth/resend/route.ts` - Enhanced with all security features

## Error Responses

### Rate Limiting (429)
```json
{
  "error": "Слишком много попыток. Повторите попытку позже.",
  "retryAfter": 300
}
```

### CAPTCHA Validation (400)
```json
{
  "error": "CAPTCHA проверка не пройдена"
}
```

### Invalid Redirect URL (400)
```json
{
  "error": "Недопустимый URL перенаправления"
}
```

## Migration Notes

### Breaking Changes
- None. The endpoint remains backward compatible.

### Optional Enhancements
- Frontend can add CAPTCHA integration for additional security
- Rate limit headers can be used for better UX

### Rollback Plan
- All changes are additive and can be disabled via environment configuration
- Original admin client approach can be restored if needed
