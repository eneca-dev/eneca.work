# Architecture Notes

## Infrastructure

- **Backend**: Supabase BaaS (no dedicated server)
- **API**: Next.js API Routes (serverless functions)
- **Cache**: No Redis available
- **Database**: PostgreSQL via Supabase

## Constraints

1. No persistent in-memory cache layer
2. API routes are serverless (cold starts)
3. Rely on Supabase features: Functions, RLS, Realtime
4. Next.js built-in caching mechanisms only
