// Keeps a per-case block of text in sync inside another record's `notes` field
// (client.notes, contact.notes). Each block is tagged with a hidden marker
// comment so it can be found and replaced without touching the rest of the
// notes the user wrote by hand.

function caseBlockMarker(caseId: string): string {
  return `<!-- case:${caseId} -->`
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function blockRegex(caseId: string): RegExp {
  const marker = escapeRegExp(caseBlockMarker(caseId))
  return new RegExp(`\\n*${marker}[\\s\\S]*?(?=\\n*<!-- case:|$)`)
}

function buildCaseBlock(caseId: string, code: string, title: string, description: string): string {
  const header = `--------- ${code} ${title} ---------`
  return `${caseBlockMarker(caseId)}\n${header}\n${description}`
}

// Adds or updates the block for this case at the end of `notes`. If
// `description` is empty, any existing block for this case is removed
// instead (nothing left to show).
export function upsertCaseBlock(
  notes: string | null | undefined,
  caseId: string,
  code: string,
  title: string,
  description: string | null | undefined,
): string {
  const base = notes ?? ''
  const re = blockRegex(caseId)
  const hasBlock = re.test(base)
  const trimmedDescription = description?.trim()

  if (!trimmedDescription) {
    return hasBlock ? base.replace(re, '').trimEnd() : base
  }

  const block = buildCaseBlock(caseId, code, title, trimmedDescription)
  if (hasBlock) {
    return base.replace(re, `\n\n${block}`).trim()
  }
  const trimmedBase = base.trimEnd()
  return trimmedBase ? `${trimmedBase}\n\n${block}` : block
}

export function removeCaseBlock(notes: string | null | undefined, caseId: string): string {
  const base = notes ?? ''
  return base.replace(blockRegex(caseId), '').trimEnd()
}
