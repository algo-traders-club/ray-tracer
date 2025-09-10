/**
 * Utility functions for Ray Tracer
 * Common helpers for formatting, validation, and calculations
 */

/**
 * Format number with commas for thousands separator
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format USD currency
 */
export function formatUSD(amount: number, decimals: number = 2): string {
  return `$${formatNumber(amount, decimals)}`;
}

/**
 * Format percentage with + or - sign
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)}%`;
}

/**
 * Format SOL amount
 */
export function formatSOL(amount: number, decimals: number = 4): string {
  return `${formatNumber(amount, decimals)} SOL`;
}

/**
 * Format token amount with symbol
 */
export function formatToken(amount: number, symbol: string, decimals: number = 6): string {
  return `${formatNumber(amount, decimals)} ${symbol}`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, startLength: number = 6, endLength: number = 4): string {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Validate number input
 */
export function validateNumber(input: string, min?: number, max?: number): number {
  const num = parseFloat(input);
  
  if (isNaN(num)) {
    throw new Error('Invalid number format');
  }
  
  if (min !== undefined && num < min) {
    throw new Error(`Value must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    throw new Error(`Value must not exceed ${max}`);
  }
  
  return num;
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(
  initialPriceRatio: number,
  currentPriceRatio: number
): number {
  const ratio = currentPriceRatio / initialPriceRatio;
  const impermanentLoss = (2 * Math.sqrt(ratio) / (1 + ratio) - 1) * 100;
  return Math.abs(impermanentLoss);
}

/**
 * Format time duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Get time ago string
 */
export function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return `${diffSeconds}s ago`;
  }
}

/**
 * Sanitize string for logging (remove sensitive data)
 */
export function sanitizeForLog(str: string): string {
  return str
    .replace(/[A-Za-z0-9+/]{40,}/g, '[REDACTED_KEY]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]')
    .replace(/api-key=[^&\s]+/gi, 'api-key=***');
}

/**
 * Create progress bar string
 */
export function createProgressBar(current: number, total: number, width: number = 20): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * width);
  const empty = width - filled;
  
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${formatPercentage(percentage * 100, 1)}`;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Retry async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}