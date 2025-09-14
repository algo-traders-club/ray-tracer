import { COLORS, LOG_EMOJIS } from '../config/constants.js';
import type { LogLevel } from '../types/index.js';

/**
 * Logger service with colored output and timestamps
 * Provides clean, production-style console output for the CLI
 */
export class LoggerService {
  private isVerbose: boolean;

  constructor(verbose: boolean = false) {
    this.isVerbose = verbose;
  }

  /**
   * Set verbose mode
   */
  public setVerbose(verbose: boolean): void {
    this.isVerbose = verbose;
  }

  /**
   * Get formatted timestamp
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format log message with color and emoji
   */
  private formatMessage(level: LogLevel, message: string, emoji?: string): string {
    const timestamp = this.getTimestamp();
    const colorCode = this.getColorForLevel(level);
    const emojiPrefix = emoji || this.getEmojiForLevel(level);
    
    return `${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${colorCode}${emojiPrefix} ${message}${COLORS.RESET}`;
  }

  /**
   * Get color code for log level
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case 'info':
        return COLORS.CYAN;
      case 'success':
        return COLORS.GREEN;
      case 'warning':
        return COLORS.YELLOW;
      case 'error':
        return COLORS.RED;
      default:
        return COLORS.WHITE;
    }
  }

  /**
   * Get emoji for log level
   */
  private getEmojiForLevel(level: LogLevel): string {
    switch (level) {
      case 'info':
        return LOG_EMOJIS.INFO;
      case 'success':
        return LOG_EMOJIS.SUCCESS;
      case 'warning':
        return LOG_EMOJIS.WARNING;
      case 'error':
        return LOG_EMOJIS.ERROR;
      default:
        return LOG_EMOJIS.INFO;
    }
  }

  /**
   * Log info message
   */
  public info(message: string, emoji?: string): void {
    console.log(this.formatMessage('info', message, emoji));
  }

  /**
   * Log success message
   */
  public success(message: string, emoji?: string): void {
    console.log(this.formatMessage('success', message, emoji));
  }

  /**
   * Log warning message
   */
  public warning(message: string, emoji?: string): void {
    console.log(this.formatMessage('warning', message, emoji));
  }

  /**
   * Log error message
   */
  public error(message: string, emoji?: string): void {
    console.error(this.formatMessage('error', message, emoji));
  }

  /**
   * Log verbose message (only shown in verbose mode)
   */
  public verbose(message: string, emoji?: string): void {
    if (this.isVerbose) {
      this.info(`[VERBOSE] ${message}`, emoji);
    }
  }

  /**
   * Log header with title
   */
  public header(title: string): void {
    console.log(`\n${COLORS.BRIGHT}${COLORS.CYAN}${LOG_EMOJIS.ROBOT} Ray Tracer - ${title}${COLORS.RESET}`);
  }

  /**
   * Log pool information
   */
  public pool(message: string): void {
    this.info(message, LOG_EMOJIS.POOL);
  }

  /**
   * Log money/financial information
   */
  public money(message: string): void {
    this.info(message, LOG_EMOJIS.MONEY);
  }

  /**
   * Log chart/analytics information
   */
  public chart(message: string): void {
    this.info(message, LOG_EMOJIS.CHART);
  }

  /**
   * Log lightning/fast operations
   */
  public lightning(message: string): void {
    this.info(message, LOG_EMOJIS.LIGHTNING);
  }

  /**
   * Log search operations
   */
  public search(message: string): void {
    this.info(message, LOG_EMOJIS.SEARCH);
  }

  /**
   * Log liquidity information
   */
  public liquidity(message: string): void {
    this.info(message, LOG_EMOJIS.DROPLET);
  }

  /**
   * Log progress indicator
   */
  public progress(message: string): void {
    process.stdout.write(`${COLORS.YELLOW}⏳ ${message}...${COLORS.RESET}`);
  }

  /**
   * Complete progress indicator
   */
  public progressComplete(): void {
    process.stdout.write(`${COLORS.GREEN} ✓${COLORS.RESET}\n`);
  }

  /**
   * Fail progress indicator
   */
  public progressFail(): void {
    process.stdout.write(`${COLORS.RED} ✗${COLORS.RESET}\n`);
  }

  /**
   * Log transaction hash
   */
  public transaction(signature: string): void {
    this.success(`Transaction: https://explorer.solana.com/tx/${signature}`);
  }

  /**
   * Log separator line
   */
  public separator(): void {
    console.log(`${COLORS.DIM}${'─'.repeat(50)}${COLORS.RESET}`);
  }

  /**
   * Log table-like data
   */
  public table(data: Record<string, string | number>): void {
    Object.entries(data).forEach(([key, value]) => {
      const formattedKey = `${key}:`.padEnd(20);
      this.info(`${formattedKey} ${value}`);
    });
  }

  /**
   * Log with custom color and emoji
   */
  public custom(message: string, color: string, emoji: string): void {
    const timestamp = this.getTimestamp();
    console.log(`${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${color}${emoji} ${message}${COLORS.RESET}`);
  }

  /**
   * Clear screen
   */
  public clear(): void {
    console.clear();
  }

  /**
   * Log newline
   */
  public newline(): void {
    console.log();
  }
}