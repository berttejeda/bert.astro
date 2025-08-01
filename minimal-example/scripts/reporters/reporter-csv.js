export default function reporterCsv(results) {
  const rows = [];

  for (const result of results) {
    const file = result.filePath;
    for (const message of result.messages) {
      rows.push([
        file,
        message.location.start.line,
        message.location.start.column,
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
