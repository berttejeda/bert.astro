import fs from 'fs';
import { createRequire } from 'module';
import debugLib from 'debug';
import path from 'path';

const debug = debugLib('csv:debugger');
const require = createRequire(import.meta.url);

export default function reporterCsv(results) {
  // Load config
  const configPath = path.resolve(process.cwd(), '.remarkrc.cjs');
  let csvOutputDir = null;
  let includePosition = true;
  let splitPerFile = false;
  let createSummary = false;

  if (fs.existsSync(configPath)) {
    const config = require(configPath);
    csvOutputDir = config.settings?.csvOutputDir;
    includePosition = config.settings?.includePosition ?? true;
    splitPerFile = config.settings?.splitPerFile ?? false;
    createSummary = config.settings?.createSummary ?? false;
  }

  // If no directory specified, fallback to stdout
  if (!csvOutputDir) {
    console.warn(
      'No `csvOutputDir` configured in .remarkrc.cjs. Defaulting to stdout for combined CSV.'
    );
    return combinedCsv(results, includePosition);
  }

  if (!fs.existsSync(csvOutputDir)) {
    fs.mkdirSync(csvOutputDir, { recursive: true });
  }

  if (splitPerFile) {
    writePerFileCSVs(results, csvOutputDir, includePosition);
  } else {
    writeCombinedCSV(results, path.join(csvOutputDir, 'lint-results.csv'), includePosition);
  }

  if (createSummary) {
    writeSummaryCSV(results, path.join(csvOutputDir, 'summary.csv'));
  }

  return '';
}

// Write one CSV per file
function writePerFileCSVs(results, dir, includePosition) {
  const grouped = groupByFile(results);

  for (const [filePath, rows] of Object.entries(grouped)) {
    const baseName = path.basename(filePath).replace(/\.[^/.]+$/, '');
    const outFile = path.join(dir, `${baseName}.csv`);
    const csv = buildCSV(rows, includePosition);
    fs.writeFileSync(outFile, csv);
    console.log(`CSV written: ${outFile}`);
  }
}

// Write single combined CSV
function writeCombinedCSV(results, outFile, includePosition) {
  const rows = flattenResults(results, includePosition);
  const csv = buildCSV(rows, includePosition);
  fs.writeFileSync(outFile, csv);
  console.log(`CSV written: ${outFile}`);
}

// Write summary CSV (file + error/warning counts)
function writeSummaryCSV(results, outFile) {
  const summary = {};

  for (const result of results) {
    const file =
      result.filePath || result.path || (result.history && result.history[0]) || 'unknown.md';
    if (!summary[file]) summary[file] = { errors: 0, warnings: 0 };

    for (const message of result.messages) {
      if (message.fatal) summary[file].errors++;
      else summary[file].warnings++;
    }
  }

  const header = ['file', 'errors', 'warnings'];
  const rows = Object.entries(summary).map(([file, counts]) => [
    file,
    counts.errors,
    counts.warnings
  ]);

  const csv =
    header.join(',') + '\n' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');

  fs.writeFileSync(outFile, csv);
  console.log(`Summary CSV written: ${outFile}`);
}

// Helpers
function groupByFile(results) {
  const grouped = {};
  for (const result of results) {
    const file =
      result.filePath || result.path || (result.history && result.history[0]) || 'unknown.md';

    if (!grouped[file]) grouped[file] = [];

    for (const message of result.messages) {
      grouped[file].push(buildRow(file, message));
    }
  }
  return grouped;
}

function flattenResults(results, includePosition) {
  const rows = [];
  for (const result of results) {
    const file =
      result.filePath || result.path || (result.history && result.history[0]) || 'unknown.md';

    for (const message of result.messages) {
      rows.push(buildRow(file, message, includePosition));
    }
  }
  return rows;
}

function buildRow(file, message, includePosition = true) {
  if (includePosition) {
    return [
      file,
      message.place?.line ?? 0,
      message.place?.column ?? 0,
      message.reason.replace(/"/g, '""'),
      message.ruleId || '',
      message.fatal ? 'error' : 'warning'
    ];
  } else {
    return [
      file,
      message.reason.replace(/"/g, '""'),
      message.ruleId || '',
      message.fatal ? 'error' : 'warning'
    ];
  }
}

function buildCSV(rows, includePosition) {
  const header = includePosition
    ? ['file', 'line', 'column', 'reason', 'ruleId', 'severity']
    : ['file', 'reason', 'ruleId', 'severity'];

  return header.join(',') + '\n' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
}

// Combined fallback to stdout
function combinedCsv(results, includePosition) {
  const rows = flattenResults(results, includePosition);
  const csv = buildCSV(rows, includePosition);
  console.log(csv);
  return '';
}
