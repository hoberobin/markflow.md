export const SHARED_DOC_KEY = 'shared'
export const DEFAULT_MARKDOWN = '# markflow.md\n\nStart typing here.\n'

export function parseDocPath(pathname: string): string | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '')
  if (trimmed === '' || trimmed === SHARED_DOC_KEY || trimmed === `${SHARED_DOC_KEY}.md`) {
    return SHARED_DOC_KEY
  }
  return null
}
