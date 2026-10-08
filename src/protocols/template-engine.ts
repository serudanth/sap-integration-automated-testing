import { randomUUID } from 'node:crypto';

/**
 * Generates an integer between min and max (inclusive).
 */
export function getRandomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

/**
 * Formats a date as YYYYMMDD or specified format.
 */
export function formatDate(date: Date = new Date(), format = 'YYYYMMDD'): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (format === 'YYYYMMDD') {
    return `${year}${month}${day}`;
  }
  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  return `${year}${month}${day}`;
}

/**
 * Evaluates template expressions in strings.
 * Supported tokens:
 * - {{$guid}}: Generates a new RFC 4122 v4 UUID
 * - {{$isoTimestamp}}: Current ISO 8601 UTC timestamp
 * - {{$date}}: Formatted date YYYYMMDD
 * - {{$timestamp}}: Unix timestamp in milliseconds
 * - {{$randomInt(min, max)}}: Random integer between min and max
 * - {{varName}}: Value from variables map
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, string | number> = {}
): string {
  if (!template) return '';

  return template
    // Replace {{$guid}}
    .replace(/\{\{\s*\$guid\s*\}\}/g, () => randomUUID())
    // Replace {{$isoTimestamp}}
    .replace(/\{\{\s*\$isoTimestamp\s*\}\}/g, () => new Date().toISOString())
    // Replace {{$date}}
    .replace(/\{\{\s*\$date\s*\}\}/g, () => formatDate())
    // Replace {{$timestamp}}
    .replace(/\{\{\s*\$timestamp\s*\}\}/g, () => Date.now().toString())
    // Replace {{$randomInt(min, max)}}
    .replace(/\{\{\s*\$randomInt\((\d+)\s*,\s*(\d+)\)\s*\}\}/g, (_, minStr, maxStr) => {
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      return getRandomInt(min, max).toString();
    })
    // Replace custom {{variable}}
    .replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
      if (key in variables) {
        return String(variables[key]);
      }
      return match;
    });
}
