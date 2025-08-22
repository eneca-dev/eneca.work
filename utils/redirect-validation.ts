/**
 * Utility for validating redirect URLs against a whitelist
 * This helps prevent open redirect vulnerabilities and unauthorized redirects
 */

export interface RedirectValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Get allowed redirect URLs from environment and configuration
 * @returns Array of allowed redirect URL patterns
 */
function getAllowedRedirectUrls(): string[] {
  const allowedUrls: string[] = []
  
  // Add site URL from environment
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    allowedUrls.push(siteUrl)
  }
  
  // Add Supabase site URL (from config.toml site_url)
  const supabaseSiteUrl = process.env.SUPABASE_SITE_URL || 'http://127.0.0.1:3000'
  allowedUrls.push(supabaseSiteUrl)
  
  // Add additional redirect URLs from environment
  const additionalUrls = process.env.SUPABASE_ADDITIONAL_REDIRECT_URLS
  if (additionalUrls) {
    const urls = additionalUrls.split(',').map(url => url.trim()).filter(Boolean)
    allowedUrls.push(...urls)
  }
  
  // Common development URLs
  allowedUrls.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://127.0.0.1:3000'
  )
  
  // Remove duplicates and return
  return [...new Set(allowedUrls)]
}

/**
 * Validate if a redirect URL is allowed
 * @param redirectUrl - The URL to validate
 * @param origin - The origin of the current request (for relative URL validation)
 * @returns RedirectValidationResult with validation status and error message
 */
export function validateRedirectUrl(redirectUrl: string, origin?: string): RedirectValidationResult {
  if (!redirectUrl) {
    return {
      isValid: false,
      error: 'Redirect URL is required'
    }
  }
  
  try {
    // Handle relative URLs by combining with origin
    let fullUrl: URL
    if (redirectUrl.startsWith('/')) {
      if (!origin) {
        return {
          isValid: false,
          error: 'Origin is required for relative URLs'
        }
      }
      fullUrl = new URL(redirectUrl, origin)
    } else {
      fullUrl = new URL(redirectUrl)
    }
    
    const allowedUrls = getAllowedRedirectUrls()
    
    // Check if the redirect URL matches any allowed URL
    for (const allowedUrl of allowedUrls) {
      try {
        const allowed = new URL(allowedUrl)
        
        // Check for exact origin match
        if (fullUrl.origin === allowed.origin) {
          return { isValid: true }
        }
        
        // Check for subdomain match (if allowed URL is a wildcard domain)
        if (allowedUrl.startsWith('*.')) {
          const domain = allowedUrl.substring(2)
          if (fullUrl.hostname.endsWith(domain)) {
            return { isValid: true }
          }
        }
      } catch (error) {
        // Skip invalid allowed URLs
        console.warn(`Invalid allowed URL in configuration: ${allowedUrl}`)
        continue
      }
    }
    
    return {
      isValid: false,
      error: `Redirect URL '${fullUrl.origin}' is not in the allowed list`
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid redirect URL format'
    }
  }
}

/**
 * Validate auth callback redirect URL specifically
 * This is a specialized validation for auth callbacks that ensures
 * the redirect URL points to the auth callback endpoint
 * @param redirectUrl - The URL to validate
 * @param origin - The origin of the current request
 * @returns RedirectValidationResult with validation status
 */
export function validateAuthCallbackUrl(redirectUrl: string, origin?: string): RedirectValidationResult {
  const baseValidation = validateRedirectUrl(redirectUrl, origin)
  if (!baseValidation.isValid) {
    return baseValidation
  }
  
  try {
    const url = new URL(redirectUrl, origin)
    
    // Ensure the path is the auth callback
    if (url.pathname !== '/auth/callback') {
      return {
        isValid: false,
        error: 'Auth redirect URL must point to /auth/callback endpoint'
      }
    }
    
    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid auth callback URL format'
    }
  }
}

/**
 * Get the list of allowed redirect URLs (for debugging/logging)
 * @returns Array of allowed redirect URLs
 */
export function getAllowedRedirectUrlsForLogging(): string[] {
  return getAllowedRedirectUrls()
}
