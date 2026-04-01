const NAME_KEY = 'mf_name'

const NAMES = ['Ash', 'River', 'Quinn', 'Sage', 'Scout', 'Blake', 'Avery', 'Finley']

export function randomName(): string {
  return `${NAMES[Math.floor(Math.random() * NAMES.length)]!}${Math.floor(Math.random() * 99)}`
}

export function readNameFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  const name = (localStorage.getItem(NAME_KEY) || '').trim()
  return name || null
}

export function saveNameToStorage(name: string): void {
  if (typeof window === 'undefined') return
  const next = (name || '').trim()
  if (next) localStorage.setItem(NAME_KEY, next)
}

export async function copyCurrentUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const text = window.location.href
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Ignore and use fallback below.
  }

  try {
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}
