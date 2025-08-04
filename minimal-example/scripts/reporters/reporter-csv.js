import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default function reporterCsv(results) {
  // Load .remarkrc.cjs manually
  const configPath = path.resolve(process.cwd(), '.remarkrc.cjs');
  let csvOutputFile = null;
  let includePosition = true; // default behavior

  if (fs.existsSync(configPath)) {
    const config = require(configPath);
    csvOutputFile = config.settings?.csvOutputFile;
    if (typeof config.settings?.includePosition === 'boolean') {
      includePosition = config.settings.includePosition;
    }
  }

  const rows = [];

  for (const result of results) {
    const file =
      result.filePath ||
      result.path ||
      (result.history && result.history[0]) ||
      '';

    for (const message of result.messages) {
      if (includePosition) {
        rows.push([
          file,
          message.place?.line ?? 0,
          message.place?.column ?? 0,
          message.reason.replace(/"/g, '""'),
          message.ruleId || '',
          message.fatal ? 'error' : 'warning'
        ]);
      } else {
        rows.push([
          file,
          message.reason.replace(/"/g, '""'),
          message.ruleId || '',
          message.fatal ? 'error' : 'warning'
        ]);
      }
    }
  }

  let header;
  if (includePosition) {
    header = ['file', 'line', 'column', 'reason', 'ruleId', 'severity'];
  } else {
    header = ['file', 'reason', 'ruleId', 'severity'];
  }

  const csv =
    header.join(',') + '\n' + rows.map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');

  if (csvOutputFile) {
    fs.writeFileSync(csvOutputFile, csv);
    console.log(`CSV report written to ${csvOutputFile}`);
    return '';
  } else {
    console.log(csv);
    return '';
  }
}
