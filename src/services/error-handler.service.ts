import { LoggerService } from './logger.service.js';

/**
 * Comprehensive error categories for DeFi operations
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  WALLET = 'WALLET', 
  TRANSACTION = 'TRANSACTION',
  SLIPPAGE = 'SLIPPAGE',
  LIQUIDITY = 'LIQUIDITY',
  VALIDATION = 'VALIDATION',
  RAYDIUM = 'RAYDIUM',
  TOKEN = 'TOKEN',
  RPC = 'RPC',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  suggestion: string;
  retryable: boolean;
  technicalDetails?: string;
}

/**
 * Comprehensive error handling service for DeFi operations
 * Provides user-friendly error messages and actionable suggestions
 */
export class ErrorHandlerService {
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * Parse and categorize any error into user-friendly format
   */
  public handleError(error: any, context?: string): ErrorInfo {
    const errorString = this.extractErrorMessage(error);
    const category = this.categorizeError(errorString);
    const severity = this.determineSeverity(category, errorString);
    
    const errorInfo = this.getErrorInfo(category, errorString, error);
    
    // Log with appropriate level
    this.logError(errorInfo, context);
    
    return errorInfo;
  }

  /**
   * Extract meaningful error message from various error types
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      // Handle Solana transaction errors
      if (error.InstructionError) {
        return `Instruction error: ${JSON.stringify(error.InstructionError)}`;
      }

      // Handle RPC errors
      if (error.code && error.message) {
        return `RPC Error ${error.code}: ${error.message}`;
      }

      // Handle fetch/network errors
      if (error.cause && error.cause.message) {
        return error.cause.message;
      }

      return JSON.stringify(error);
    }

    return 'Unknown error occurred';
  }

  /**
   * Categorize error based on error message patterns
   */
  private categorizeError(errorMessage: string): ErrorCategory {
    const lowerMessage = errorMessage.toLowerCase();

    // Network and RPC errors
    if (this.matchesPattern(lowerMessage, [
      'network', 'timeout', 'connection', 'econnreset', 'enotfound',
      'fetch', '429', 'rate limit', 'service unavailable'
    ])) {
      return ErrorCategory.NETWORK;
    }

    // RPC-specific errors
    if (this.matchesPattern(lowerMessage, [
      'rpc', 'node', 'endpoint', 'blockhash', 'slot', 'commitment'
    ])) {
      return ErrorCategory.RPC;
    }

    // Wallet and account errors
    if (this.matchesPattern(lowerMessage, [
      'insufficient funds', 'balance', 'account not found', 'private key',
      'keypair', 'signature', 'unauthorized'
    ])) {
      return ErrorCategory.WALLET;
    }

    // Transaction-specific errors
    if (this.matchesPattern(lowerMessage, [
      'transaction', 'instruction', 'simulation failed', 'compute',
      'program error', 'account in use', 'blockhash expired'
    ])) {
      return ErrorCategory.TRANSACTION;
    }

    // Slippage and pricing errors
    if (this.matchesPattern(lowerMessage, [
      'slippage', 'price', 'tolerance', 'minimum', 'maximum', 'amount'
    ])) {
      return ErrorCategory.SLIPPAGE;
    }

    // Liquidity pool errors
    if (this.matchesPattern(lowerMessage, [
      'liquidity', 'pool', 'reserves', 'lp token', 'swap', 'amm'
    ])) {
      return ErrorCategory.LIQUIDITY;
    }

    // Raydium-specific errors
    if (this.matchesPattern(lowerMessage, [
      'raydium', 'pool info', 'pool keys', 'market', 'openbook'
    ])) {
      return ErrorCategory.RAYDIUM;
    }

    // Token-related errors
    if (this.matchesPattern(lowerMessage, [
      'token', 'mint', 'decimals', 'spl', 'associated token account'
    ])) {
      return ErrorCategory.TOKEN;
    }

    // Validation errors
    if (this.matchesPattern(lowerMessage, [
      'invalid', 'validation', 'format', 'required', 'missing', 'expected'
    ])) {
      return ErrorCategory.VALIDATION;
    }

    // Configuration errors
    if (this.matchesPattern(lowerMessage, [
      'environment', 'config', 'api key', 'url', 'setting'
    ])) {
      return ErrorCategory.CONFIGURATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Check if message matches any of the patterns
   */
  private matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.some(pattern => message.includes(pattern));
  }

  /**
   * Determine error severity
   */
  private determineSeverity(category: ErrorCategory, message: string): ErrorSeverity {
    const lowerMessage = message.toLowerCase();

    // Critical errors that prevent operation
    if (category === ErrorCategory.CONFIGURATION || 
        lowerMessage.includes('private key') ||
        lowerMessage.includes('critical')) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (category === ErrorCategory.WALLET && lowerMessage.includes('insufficient') ||
        category === ErrorCategory.TRANSACTION && lowerMessage.includes('failed') ||
        lowerMessage.includes('unauthorized')) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (category === ErrorCategory.SLIPPAGE ||
        category === ErrorCategory.LIQUIDITY ||
        category === ErrorCategory.RPC) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Get detailed error information with suggestions
   */
  private getErrorInfo(category: ErrorCategory, message: string, originalError?: any): ErrorInfo {
    const lowerMessage = message.toLowerCase();

    switch (category) {
      case ErrorCategory.NETWORK:
        return {
          category,
          severity: this.determineSeverity(category, message),
          message: 'Network connection issue',
          suggestion: 'Check internet connection, try different RPC endpoint, or wait and retry',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.RPC:
        return {
          category,
          severity: this.determineSeverity(category, message),
          message: 'RPC endpoint error',
          suggestion: 'Verify Helius API key, check RPC URL, or try different commitment level',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.WALLET:
        if (lowerMessage.includes('insufficient')) {
          return {
            category,
            severity: ErrorSeverity.HIGH,
            message: 'Insufficient balance in wallet',
            suggestion: 'Add more SOL to wallet or reduce transaction amount. Keep ~0.01 SOL for fees',
            retryable: false,
            technicalDetails: message
          };
        }
        return {
          category,
          severity: this.determineSeverity(category, message),
          message: 'Wallet authentication or access error',
          suggestion: 'Check private key format, wallet permissions, or account status',
          retryable: false,
          technicalDetails: message
        };

      case ErrorCategory.SLIPPAGE:
        return {
          category,
          severity: ErrorSeverity.MEDIUM,
          message: 'Transaction failed due to price movement',
          suggestion: 'Increase slippage tolerance (--slippage 1.0) or try during stable market conditions',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.TRANSACTION:
        if (lowerMessage.includes('simulation')) {
          return {
            category,
            severity: ErrorSeverity.HIGH,
            message: 'Transaction simulation failed',
            suggestion: 'Check wallet balance, slippage settings, or pool availability',
            retryable: true,
            technicalDetails: message
          };
        }
        return {
          category,
          severity: this.determineSeverity(category, message),
          message: 'Transaction execution error',
          suggestion: 'Retry with higher priority fee or different parameters',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.LIQUIDITY:
        return {
          category,
          severity: ErrorSeverity.MEDIUM,
          message: 'Liquidity pool operation failed',
          suggestion: 'Check pool health, verify pool ID, or try smaller amounts',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.RAYDIUM:
        return {
          category,
          severity: ErrorSeverity.MEDIUM,
          message: 'Raydium protocol error',
          suggestion: 'Verify pool exists and is active, check Raydium API status',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.TOKEN:
        return {
          category,
          severity: ErrorSeverity.MEDIUM,
          message: 'Token operation failed',
          suggestion: 'Check token accounts exist, verify mint addresses, or create associated accounts',
          retryable: true,
          technicalDetails: message
        };

      case ErrorCategory.VALIDATION:
        return {
          category,
          severity: ErrorSeverity.LOW,
          message: 'Input validation failed',
          suggestion: 'Check command parameters, format, and ranges',
          retryable: false,
          technicalDetails: message
        };

      case ErrorCategory.CONFIGURATION:
        return {
          category,
          severity: ErrorSeverity.CRITICAL,
          message: 'Configuration error',
          suggestion: 'Check .env file settings, API keys, and environment variables',
          retryable: false,
          technicalDetails: message
        };

      default:
        return {
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.LOW,
          message: 'An unexpected error occurred',
          suggestion: 'Enable verbose logging (--verbose) for more details or contact support',
          retryable: true,
          technicalDetails: message
        };
    }
  }

  /**
   * Log error with appropriate formatting
   */
  private logError(errorInfo: ErrorInfo, context?: string): void {
    const contextStr = context ? ` [${context}]` : '';
    
    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL${contextStr}: ${errorInfo.message}`);
        this.logger.error(`💡 ${errorInfo.suggestion}`);
        break;
        
      case ErrorSeverity.HIGH:
        this.logger.error(`${contextStr}: ${errorInfo.message}`);
        this.logger.warning(`💡 ${errorInfo.suggestion}`);
        break;
        
      case ErrorSeverity.MEDIUM:
        this.logger.warning(`${contextStr}: ${errorInfo.message}`);
        this.logger.info(`💡 ${errorInfo.suggestion}`);
        break;
        
      case ErrorSeverity.LOW:
        this.logger.info(`${contextStr}: ${errorInfo.message}`);
        this.logger.verbose(`💡 ${errorInfo.suggestion}`);
        break;
    }

    // Log technical details in verbose mode
    if (errorInfo.technicalDetails) {
      this.logger.verbose(`Technical details: ${errorInfo.technicalDetails}`);
    }
  }

  /**
   * Check if operation should be retried based on error
   */
  public shouldRetry(errorInfo: ErrorInfo, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    if (!errorInfo.retryable) return false;
    
    // Don't retry critical or validation errors
    if (errorInfo.severity === ErrorSeverity.CRITICAL) return false;
    if (errorInfo.category === ErrorCategory.VALIDATION) return false;
    
    return true;
  }

  /**
   * Get user-friendly error message for CLI output
   */
  public getDisplayMessage(errorInfo: ErrorInfo): string {
    return `❌ ${errorInfo.message}\n💡 Suggestion: ${errorInfo.suggestion}`;
  }

  /**
   * Common DeFi error scenarios with specific handling
   */
  public handleCommonDefiErrors(error: any): ErrorInfo {
    const message = this.extractErrorMessage(error);
    const lowerMessage = message.toLowerCase();

    // Handle specific common scenarios
    if (lowerMessage.includes('insufficient funds') && lowerMessage.includes('0x1')) {
      return {
        category: ErrorCategory.WALLET,
        severity: ErrorSeverity.HIGH,
        message: 'Insufficient SOL balance for transaction fees',
        suggestion: 'Add at least 0.01 SOL to your wallet for transaction fees',
        retryable: false,
        technicalDetails: message
      };
    }

    if (lowerMessage.includes('slippage tolerance exceeded')) {
      return {
        category: ErrorCategory.SLIPPAGE,
        severity: ErrorSeverity.MEDIUM,
        message: 'Price moved beyond acceptable slippage',
        suggestion: 'Increase slippage tolerance with --slippage 2.0 or try smaller amounts',
        retryable: true,
        technicalDetails: message
      };
    }

    if (lowerMessage.includes('pool not found') || lowerMessage.includes('invalid pool')) {
      return {
        category: ErrorCategory.RAYDIUM,
        severity: ErrorSeverity.HIGH,
        message: 'Raydium pool not accessible',
        suggestion: 'Verify pool ID in constants.ts and check if pool is still active',
        retryable: false,
        technicalDetails: message
      };
    }

    // Fallback to general error handling
    return this.handleError(error);
  }
}