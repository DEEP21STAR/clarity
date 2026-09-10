/**
 * Real file-save via the `downloads` runtime capability (declared on the
 * artifact publish as `capabilities: { downloads: true }`). Replaces the
 * earlier `<a download>` approach, which the platform confirmed is dead
 * inside the artifact viewer sandbox for every viewer, owner included.
 *
 * `claude.use("downloads")` resolves to `null` when this capability isn't
 * available in the current view — always fall back to clipboard copy in
 * that case (and on any other failure/decline), never assume the save
 * silently worked.
 */
export type SaveOutcome = 'saved' | 'unavailable' | 'declined' | 'error'

export async function saveFile(filename: string, data: string): Promise<SaveOutcome> {
  try {
    const w = window as unknown as { claude?: { use: (name: string) => Promise<any> } }
    if (!w.claude?.use) return 'unavailable'
    const downloads = await w.claude.use('downloads')
    if (!downloads) return 'unavailable'
    await downloads.save({ filename, data })
    return 'saved'
  } catch (err: unknown) {
    const code = (err as { code?: string } | undefined)?.code
    if (code === 'declined') return 'declined'
    return 'error'
  }
}
