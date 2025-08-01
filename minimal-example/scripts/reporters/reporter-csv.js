export default function reporterCsv(results) {
  const rows = [];

  for (const result of results) {
    const file = result.filePath;

    for (const message of result.messages) {
      // Use optional chaining and default to 0 if missing
      const line = message.location?.start?.line ?? 0;
      const column = message.location?.start?.column ?? 0;

      rows.push([
        file,
        line,
        column,
        message.reason.replace(/"/g, '""'), // escape quotes
        message.ruleId || '',
        message.fatal ? 'error' : 'warning'
      ]);
    }
  }

  // Always print header (for empty or non-empty results)
  console.log(['file', 'line', 'column', 'reason', 'ruleId', 'severity'].join(','));

  for (const row of rows) {
    console.log(row.map((v) => `"${v}"`).join(','));
  }
}
