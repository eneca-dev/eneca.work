/**
 * Employment Board - Redis (Upstash)
 *
 * Redis здесь — вспомогательный слой над Postgres, а НЕ источник истины.
 * Полная потеря Redis не теряет данные: всё восстанавливается из БД.
 * Любая ошибка Redis не должна ронять страницу — все хелперы гасят исключения
 * и деградируют до прямого чтения/записи в Postgres.
 */

import { randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = url && token ? new Redis({ url, token }) : null

/** Redis сконфигурирован (иначе работаем напрямую с Postgres) */
export const isRedisEnabled = redis !== null

// Изменения загрузок могут приходить из других модулей, где Redis-доска не
// инвалидируется напрямую. Короткий TTL ограничивает такое окно устаревания;
// ручные действия доски по-прежнему инвалидируют кэш мгновенно через INCR.
const BOARD_TTL_SECONDS = 60
const LOCK_TTL_MS = 3000
const BUILD_LOCK_TTL_MS = 5000
const PRESENCE_TTL_SECONDS = 20
const WRITE_RATE_WINDOW_SECONDS = 10
const WRITE_RATE_LIMIT = 20

type Lock = { acquired: true; token: string | null } | { acquired: false }

const releaseOwnedLock = redis?.createScript<number>(
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
)

const incrementRateLimit = redis?.createScript<number>(
  "local current = redis.call('INCR', KEYS[1]) if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return current",
)

function versionKey(departmentId: string): string {
  return `employment-board:ver:${departmentId}`
}

/**
 * Текущая версия данных отдела.
 *
 * Версия входит в ключ кэша, а инвалидация — это INCR. Так закрывается гонка
 * cache-aside: читатель, начавший сборку до записи, допишет свой устаревший
 * снимок под СТАРОЙ версией ключа, и его уже никто не прочитает.
 * DEL такую гонку не закрывает — «медленный» читатель пишет уже после удаления.
 */
export async function getBoardVersion(departmentId: string): Promise<number> {
  if (!redis) return 0
  try {
    const value = await redis.get<number | string>(versionKey(departmentId))
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/**
 * Ключ кэша доски.
 *
 * isAdmin пишем открытым текстом: от него зависит видимость restricted-проектов,
 * и коллизия 32-битного scopeHash не должна склеить админский и обычный кэш.
 */
export function boardCacheKey(
  departmentId: string,
  isAdmin: boolean,
  scopeHash: string,
  version: number,
): string {
  // v1 в namespace отделяет формат ключа от более ранних реализаций модуля.
  return `employment-board:v1:${departmentId}:${isAdmin ? 'a' : 'u'}:${scopeHash}:v${version}`
}

export async function readBoardCache<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

export async function writeBoardCache<T>(key: string, value: T): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, { ex: BOARD_TTL_SECONDS })
  } catch {
    // кэш не критичен — молча игнорируем
  }
}

/**
 * Инвалидация — одна O(1) команда вместо SCAN по всему пространству ключей.
 * Ключи прошлых версий никто не читает, они уходят сами по TTL.
 */
export async function invalidateBoardCache(departmentId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.incr(versionKey(departmentId))
  } catch {
    // запись в Postgres уже прошла; кэш протухнет сам через TTL
  }
}

/**
 * Пытается взять короткий распределённый лок (SET NX PX).
 * Защищает от гонки, когда двое одновременно перетаскивают одного сотрудника.
 *
 * Если Redis недоступен — возвращает true: UNIQUE-констрейнт в Postgres
 * остаётся последней линией защиты, блокировать работу пользователя не за что.
 */
export async function acquireLock(key: string, ttlMs = LOCK_TTL_MS): Promise<Lock> {
  if (!redis) return { acquired: true, token: null }
  try {
    const token = randomUUID()
    const result = await redis.set(key, token, { nx: true, px: ttlMs })
    return result === 'OK' ? { acquired: true, token } : { acquired: false }
  } catch {
    return { acquired: true, token: null }
  }
}

export async function releaseLock(key: string, token: string | null): Promise<void> {
  if (!redis || !token || !releaseOwnedLock) return
  try {
    // Удаляем только свой лок. Если TTL истёк и ключ уже успел занять другой
    // запрос, его lock останется нетронутым.
    await releaseOwnedLock.exec([key], [token])
  } catch {
    // лок сам истечёт по PX
  }
}

export function placementLockKey(departmentId: string, employeeId: string): string {
  return `lock:placement:${departmentId}:${employeeId}`
}

export function boardBuildLockKey(departmentId: string, version: number): string {
  return `lock:employment-board:build:${departmentId}:v${version}`
}

export async function acquireBoardBuildLock(departmentId: string, version: number): Promise<Lock> {
  return acquireLock(boardBuildLockKey(departmentId, version), BUILD_LOCK_TTL_MS)
}

export function presenceKey(departmentId: string, userId: string): string {
  return `presence:employment-board:${departmentId}:${userId}`
}

export async function touchBoardPresence(departmentId: string, userId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.set(presenceKey(departmentId, userId), Date.now(), { ex: PRESENCE_TTL_SECONDS })
  } catch {
    // Presence не критичен для работы доски.
  }
}

export async function getBoardPresenceUserIds(departmentId: string): Promise<string[]> {
  if (!redis) return []
  const prefix = `presence:employment-board:${departmentId}:`
  const ids = new Set<string>()
  let cursor = '0'

  try {
    // SCAN не блокирует Redis, unlike KEYS. Ограничиваем обход четырьмя
    // страницами: presence — индикатор, а не критичный список.
    for (let page = 0; page < 4; page++) {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${prefix}*`, count: 100 })
      for (const key of keys) {
        const userId = key.slice(prefix.length)
        if (userId) ids.add(userId)
      }
      if (nextCursor === '0') break
      cursor = nextCursor
    }
  } catch {
    return []
  }

  return [...ids]
}

/** Fixed-window rate limit for manual board actions. Redis outage fails open. */
export async function checkBoardWriteRateLimit(userId: string): Promise<boolean> {
  if (!redis || !incrementRateLimit) return true
  const bucket = Math.floor(Date.now() / (WRITE_RATE_WINDOW_SECONDS * 1000))
  try {
    const count = await incrementRateLimit.exec(
      [`rate:employment-board:write:${userId}:${bucket}`],
      [String(WRITE_RATE_WINDOW_SECONDS)],
    )
    return count <= WRITE_RATE_LIMIT
  } catch {
    return true
  }
}
