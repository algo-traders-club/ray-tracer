import dotenv from 'dotenv';
import { DEFAULT_CONFIG } from './constants.js';

// Load environment variables
dotenv.config();

export type CommitmentLevel = 'processed' | 'confirmed' | 'finalized';
export type LogLevel = 'info' | 'verbose' | 'debug';

/**
 * Environment configuration with comprehensive validation
 * Ensures all required environment variables are present and valid
 */
export class Environment {
  // Required settings
  public readonly privateKey: string;
  public readonly rpcUrl: string;
  
  // Trading parameters
  public readonly slippageTolerance: number;
  public readonly priorityFeeMicroLamports: number;
  
  // Advanced settings
  public readonly commitmentLevel: CommitmentLevel;
  public readonly rpcTimeoutMs: number;
  public readonly maxRetries: number;
  public readonly retryBaseDelayMs: number;
  public readonly monitorIntervalMs: number;
  
  // Safety settings
  public readonly maxPositionSizeSol: number;
  public readonly testMode: boolean;
  public readonly logLevel: LogLevel;

  constructor() {
    // Required configuration
    this.privateKey = this.getRequiredEnvVar('PRIVATE_KEY');
    this.rpcUrl = this.getRequiredEnvVar('HELIUS_RPC_URL');
    
    // Trading parameters
    this.slippageTolerance = this.getNumberEnvVar(
      'SLIPPAGE_TOLERANCE', 
      DEFAULT_CONFIG.SLIPPAGE_TOLERANCE,
      { min: 0.1, max: 50 }
    );
    
    this.priorityFeeMicroLamports = this.getNumberEnvVar(
      'PRIORITY_FEE_MICRO_LAMPORTS', 
      DEFAULT_CONFIG.PRIORITY_FEE_MICRO_LAMPORTS,
      { min: 0, max: 1000000 }
    );
    
    // Advanced settings
    this.commitmentLevel = this.getEnumEnvVar(
      'COMMITMENT_LEVEL',
      'confirmed',
      ['processed', 'confirmed', 'finalized']
    ) as CommitmentLevel;
    
    this.rpcTimeoutMs = this.getNumberEnvVar(
      'RPC_TIMEOUT_MS',
      DEFAULT_CONFIG.RPC_TIMEOUT_MS,
      { min: 5000, max: 120000 }
    );
    
    this.maxRetries = this.getNumberEnvVar(
      'MAX_RETRIES',
      DEFAULT_CONFIG.MAX_RETRIES,
      { min: 1, max: 10 }
    );
    
    this.retryBaseDelayMs = this.getNumberEnvVar(
      'RETRY_BASE_DELAY_MS',
      1000,
      { min: 100, max: 10000 }
    );
    
    this.monitorIntervalMs = this.getNumberEnvVar(
      'MONITOR_INTERVAL_MS',
      DEFAULT_CONFIG.MONITOR_INTERVAL_MS,
      { min: 1000, max: 60000 }
    );
    
    // Safety settings
    this.maxPositionSizeSol = this.getNumberEnvVar(
      'MAX_POSITION_SIZE_SOL',
      1.0,
      { min: 0, max: 1000 }
    );
    
    this.testMode = this.getBooleanEnvVar('TEST_MODE', false);
    
    this.logLevel = this.getEnumEnvVar(
      'LOG_LEVEL',
      'info',
      ['info', 'verbose', 'debug']
    ) as LogLevel;

    this.validate();
  }

  /**
   * Get required environment variable or throw error
   */
  private getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(
        `Missing required environment variable: ${name}. ` +
        `Please check your .env file and ensure ${name} is set.`
      );
    }
    return value;
  }

  /**
   * Get optional number environment variable with default and validation
   */
  private getNumberEnvVar(
    name: string, 
    defaultValue: number, 
    options?: { min?: number; max?: number }
  ): number {
    const value = process.env[name];
    if (!value) {
      return defaultValue;
    }
    
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(
        `Invalid number value for environment variable ${name}: ${value}`
      );
    }
    
    if (options?.min !== undefined && parsed < options.min) {
      throw new Error(
        `Environment variable ${name} must be at least ${options.min}, got: ${parsed}`
      );
    }
    
    if (options?.max !== undefined && parsed > options.max) {
      throw new Error(
        `Environment variable ${name} must not exceed ${options.max}, got: ${parsed}`
      );
    }
    
    return parsed;
  }

  /**
   * Get boolean environment variable with default
   */
  private getBooleanEnvVar(name: string, defaultValue: boolean): boolean {
    const value = process.env[name];
    if (!value) {
      return defaultValue;
    }
    
    const normalized = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
    
    throw new Error(
      `Invalid boolean value for environment variable ${name}: ${value}. ` +
      `Expected: true/false, 1/0, yes/no, on/off`
    );
  }

  /**
   * Get enum environment variable with validation
   */
  private getEnumEnvVar(name: string, defaultValue: string, validValues: string[]): string {
    const value = process.env[name];
    if (!value) {
      return defaultValue;
    }
    
    if (!validValues.includes(value)) {
      throw new Error(
        `Invalid value for environment variable ${name}: ${value}. ` +
        `Valid options: ${validValues.join(', ')}`
      );
    }
    
    return value;
  }

  /**
   * Validate environment configuration
   */
  private validate(): void {
    // Validate private key format (base58 encoded should be 32-88 characters)
    if (this.privateKey.length < 32 || this.privateKey.length > 88) {
      throw new Error(
        'Invalid private key format. Expected base58 encoded private key (32-88 characters).'
      );
    }

    // Try to decode private key to validate format
    try {
      if (this.privateKey.startsWith('[')) {
        // Handle JSON array format
        const keyArray = JSON.parse(this.privateKey);
        if (!Array.isArray(keyArray) || keyArray.length !== 64) {
          throw new Error('Invalid private key array format');
        }
      } else {
        // Should be base58 format
        if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(this.privateKey)) {
          throw new Error('Invalid base58 characters in private key');
        }
      }
    } catch (error) {
      throw new Error(
        `Invalid private key format: ${error}. Expected base58 string or 64-element array.`
      );
    }

    // Validate RPC URL format
    if (!this.rpcUrl.startsWith('http://') && !this.rpcUrl.startsWith('https://')) {
      throw new Error(
        'Invalid RPC URL format. Expected URL starting with http:// or https://'
      );
    }

    // Validate URL is not just placeholder
    if (this.rpcUrl.includes('your_helius_api_key') || this.rpcUrl.includes('your_api_key')) {
      throw new Error(
        'Please replace the placeholder API key in HELIUS_RPC_URL with your actual key from helius.dev'
      );
    }

    // Test mode warnings
    if (this.testMode) {
      console.warn('⚠️  TEST MODE ENABLED: All operations will use minimal amounts (0.001 SOL)');
    }

    // Position size safety check
    if (this.maxPositionSizeSol > 10) {
      console.warn(`⚠️  Large position size limit: ${this.maxPositionSizeSol} SOL. Consider reducing for safety.`);
    }

    // High slippage warning
    if (this.slippageTolerance > 5) {
      console.warn(`⚠️  High slippage tolerance: ${this.slippageTolerance}%. This may result in unfavorable trades.`);
    }
  }

  /**
   * Get configuration summary for logging
   */
  public getSummary(): string {
    const sanitizedUrl = this.rpcUrl.replace(/api-key=[^&]+/gi, 'api-key=***');
    
    return [
      `RPC URL: ${sanitizedUrl}`,
      `Commitment: ${this.commitmentLevel}`,
      `Slippage Tolerance: ${this.slippageTolerance}%`,
      `Priority Fee: ${this.priorityFeeMicroLamports} micro-lamports`,
      `Max Position Size: ${this.maxPositionSizeSol} SOL`,
      `Test Mode: ${this.testMode ? 'ENABLED' : 'disabled'}`,
      `Log Level: ${this.logLevel}`,
      `Max Retries: ${this.maxRetries}`
    ].join('\n');
  }

  /**
   * Validate private key without exposing it in logs
   */
  public isPrivateKeyValid(): { valid: boolean; error?: string } {
    try {
      // Basic length check
      if (this.privateKey.length < 32 || this.privateKey.length > 88) {
        return { valid: false, error: 'Invalid key length' };
      }

      // Format validation
      if (this.privateKey.startsWith('[')) {
        const keyArray = JSON.parse(this.privateKey);
        if (!Array.isArray(keyArray) || keyArray.length !== 64) {
          return { valid: false, error: 'Invalid array format' };
        }
      } else if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(this.privateKey)) {
        return { valid: false, error: 'Invalid base58 format' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Parse error' };
    }
  }
}

// Export singleton instance
export const env = new Environment();