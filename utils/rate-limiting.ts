import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

/**
 * Rate limiting utility for API endpoints
 * @param request - NextRequest object
 * @param options - Rate limiting configuration
 * @returns RateLimitResult with success status and metadata
 */
export function rateLimit(request: NextRequest, options: RateLimitOptions): RateLimitResult {
  const { windowMs, maxRequests, keyGenerator } = options
  const now = Date.now()
  
  // Generate key for rate limiting (IP address by default)
  const key = keyGenerator ? keyGenerator(request) : getClientIP(request)
  
  // Clean up expired entries
  cleanupExpiredEntries(now)
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetTime: now + windowMs
    }
    rateLimitStore.set(key, entry)
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime: entry.resetTime
    }
  }
  
  // Increment counter
  entry.count++
  
  if (entry.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }
  
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Get client IP address from request headers
 * @param request - NextRequest object
 * @returns IP address string
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to connection remote address (may not be available in all environments)
  return request.headers.get('x-forwarded-for') || 'unknown'
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 * @param now - Current timestamp
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Rate limit configuration for email resend operations
 */
export const EMAIL_RESEND_RATE_LIMIT: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // Maximum 3 resend requests per 15 minutes per IP
}

/**
 * Rate limit configuration for general API endpoints
 */
export const GENERAL_API_RATE_LIMIT: RateLimitOptions = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 100, // Maximum 100 requests per 5 minutes per IP
}
