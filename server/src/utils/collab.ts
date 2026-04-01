export const SHARED_DOC_KEY = 'shared'
export const DEFAULT_MARKDOWN = '# markflow.md\n\nStart typing here.\n'

export function parseDocPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return SHARED_DOC_KEY
  }

  const last = segments[segments.length - 1]?.toLowerCase()
  if (last === SHARED_DOC_KEY || last === `${SHARED_DOC_KEY}.md`) return SHARED_DOC_KEY

  return null
}
