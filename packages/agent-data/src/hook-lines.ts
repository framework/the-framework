/**
 * Whether a shell line runs a tool: one of the tool's commands, bare or by a path, or its
 * package's name, with or without a version, stands in the line as a word of its own. How a
 * project's hook lines are read for "does this project run the scheduler": by the dashboard, to
 * give the project the tool's page, and by the tool itself, to write no second line beside one
 * that already runs it and to take its own lines back. A name inside another word is not it.
 */
export function lineRuns(line: string, tool: { name: string; commands: readonly string[] }): boolean {
  return line
    .split(/[\s"'`=;|&()<>]+/)
    .some(word => word.replace(/@[\w.^~<>=*-]+$/, '') === tool.name || tool.commands.includes(word.slice(word.lastIndexOf('/') + 1)))
}
