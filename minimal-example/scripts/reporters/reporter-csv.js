import debugLib from 'debug';

const debug = debugLib('csv:debugger');

export default function reporterCsv(results) {
  const rows = [];
  for (const result of results) {
    const file =
      result.filePath ||
      result.path ||
      (result.history && result.history[0]) ||
      '';
    
    for (const message of result.messages) {
      // Handle both point and range positions
      const loc = message.place || {};
      const line = loc.start?.line ?? loc.line ?? 0;
      const column = loc.start?.column ?? loc.column ?? 0;
      rows.push([
        file,
        line,
        column,
        message.reason.replace(/"/g, '""'),
        message.ruleId || '',
        message.fatal ? 'error' : 'warning'
      ]);
    }
  }

  console.log(['file', 'line', 'column', 'reason', 'ruleId', 'severity'].join(','));

  for (const row of rows) {
    console.log(row.map((v) => `"${v}"`).join(','));
  }
}
