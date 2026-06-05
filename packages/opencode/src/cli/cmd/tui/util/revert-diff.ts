import { parsePatch, type StructuredPatch, type StructuredPatchHunk } from "diff"

export function getRevertDiffFiles(diffText: string) {
  if (!diffText) return []

  try {
    return parsePatch(diffText).map((patch: StructuredPatch) => {
      const filename = [patch.newFileName, patch.oldFileName].find((item) => item && item !== "/dev/null") ?? "unknown"
      return {
        filename: filename.replace(/^[ab]\//, ""),
        additions: patch.hunks.reduce((sum: number, hunk: StructuredPatchHunk) => sum + hunk.lines.filter((line: string) => line.startsWith("+")).length, 0),
        deletions: patch.hunks.reduce((sum: number, hunk: StructuredPatchHunk) => sum + hunk.lines.filter((line: string) => line.startsWith("-")).length, 0),
      }
    })
  } catch {
    return []
  }
}
