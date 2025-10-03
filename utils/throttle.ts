export function throttle<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let last = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null

  function invoke(now: number) {
    last = now
    // eslint-disable-next-line prefer-spread
    fn.apply(null, lastArgs as any[])
    lastArgs = null
  }

  const throttled = (...args: any[]) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    lastArgs = args

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      invoke(now)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        invoke(Date.now())
      }, remaining)
    }
  }

  ;(throttled as any).cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
  }

  return throttled as T & { cancel: () => void }
}



