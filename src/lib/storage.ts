// localStorage JSON helpers that never throw (private mode, quota, junk values).

/** The array stored under `key`, or [] when missing, unparsable or not an array. */
export function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as T[]) : []
  } catch {
    return []
  }
}

/** Stores `value` as JSON under `key`; a failed write (private mode) is dropped. */
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode */
  }
}
