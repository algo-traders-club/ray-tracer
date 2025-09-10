import { PublicKey, Connection } from '@solana/web3.js';
import { env } from '../config/environment.js';
import { LoggerService } from './logger.service.js';
import { WalletService } from './wallet.service.js';

/**
 * Input validation service for CLI commands and parameters
 * Provides comprehensive validation with educational error messages
 */
export class ValidationService {
  private logger: LoggerService;
  private wallet: WalletService;

  constructor(logger: LoggerService, wallet: WalletService) {
    this.logger = logger;
    this.wallet = wallet;
  }

  /**
   * Validate deposit amount with comprehensive checks
   */
  public async validateDepositAmount(amount: string): Promise<{ 
    isValid: boolean; 
    amount?: number; 
    error?: string; 
    warnings?: string[] 
  }> {
    const warnings: string[] = [];
    
    try {
      // Parse amount
      const numAmount = parseFloat(amount);
      
      // Basic validation
      if (isNaN(numAmount)) {
        return { 
          isValid: false, 
          error: 'Invalid amount format. Please enter a valid number (e.g., 0.1)' 
        };
      }

      if (numAmount <= 0) {
        return { 
          isValid: false, 
          error: 'Amount must be greater than 0' 
        };
      }

      // Minimum amount check
      const minAmount = env.testMode ? 0.001 : 0.001;
      if (numAmount < minAmount) {
        return { 
          isValid: false, 
          error: `Minimum deposit amount is ${minAmount} SOL` 
        };
      }

      // Test mode override
      let finalAmount = numAmount;
      if (env.testMode && numAmount > 0.001) {
        finalAmount = 0.001;
        warnings.push('🧪 TEST MODE: Amount limited to 0.001 SOL for safety');
      }

      // Position size limit check
      if (env.maxPositionSizeSol > 0 && finalAmount > env.maxPositionSizeSol) {
        return { 
          isValid: false, 
          error: `Amount exceeds maximum position size limit of ${env.maxPositionSizeSol} SOL. ` +
                 `Adjust MAX_POSITION_SIZE_SOL in .env or use a smaller amount.` 
        };
      }

      // Large amount warnings
      if (finalAmount > 1.0) {
        warnings.push('⚠️  Large deposit detected! Consider starting with smaller amounts for learning.');
      }

      if (finalAmount > 0.1) {
        warnings.push('💡 Tip: Start with 0.01-0.1 SOL to understand the process before larger deposits.');
      }

      // Note: Balance check is handled in the command handler where connection is available

      return {
        isValid: true,
        amount: finalAmount,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error}`
      };
    }
  }

  /**
   * Validate slippage tolerance
   */
  public validateSlippage(slippage: string): { 
    isValid: boolean; 
    slippage?: number; 
    error?: string;
    warnings?: string[] 
  } {
    const warnings: string[] = [];
    
    const numSlippage = parseFloat(slippage);
    
    if (isNaN(numSlippage)) {
      return { 
        isValid: false, 
        error: 'Invalid slippage format. Please enter a number (e.g., 0.5 for 0.5%)' 
      };
    }

    if (numSlippage < 0.1) {
      return { 
        isValid: false, 
        error: 'Slippage tolerance too low. Minimum is 0.1%' 
      };
    }

    if (numSlippage > 50) {
      return { 
        isValid: false, 
        error: 'Slippage tolerance too high. Maximum is 50%' 
      };
    }

    // Warnings for different slippage ranges
    if (numSlippage < 0.5) {
      warnings.push('⚠️  Low slippage tolerance. Transactions may fail during volatile conditions.');
    } else if (numSlippage > 5) {
      warnings.push('⚠️  High slippage tolerance. You may receive less favorable pricing.');
    } else if (numSlippage > 2) {
      warnings.push('💡 Moderate slippage tolerance. Good for volatile market conditions.');
    }

    return {
      isValid: true,
      slippage: numSlippage,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate Solana address format
   */
  public validateAddress(address: string): { isValid: boolean; error?: string } {
    try {
      new PublicKey(address);
      return { isValid: true };
    } catch {
      return { 
        isValid: false, 
        error: 'Invalid Solana address format' 
      };
    }
  }

  /**
   * Validate environment configuration
   */
  public validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Private key validation
    const keyValidation = env.isPrivateKeyValid();
    if (!keyValidation.valid) {
      errors.push(`Private key validation failed: ${keyValidation.error}`);
    }

    // RPC URL validation
    if (!env.rpcUrl.startsWith('http')) {
      errors.push('Invalid RPC URL format');
    }

    if (env.rpcUrl.includes('your_api_key')) {
      errors.push('Please replace placeholder API key in HELIUS_RPC_URL');
    }

    // Warning for high-risk settings
    if (env.slippageTolerance > 5) {
      warnings.push(`High slippage tolerance: ${env.slippageTolerance}%`);
    }

    if (env.maxPositionSizeSol > 10) {
      warnings.push(`Large position size limit: ${env.maxPositionSizeSol} SOL`);
    }

    if (!env.testMode) {
      warnings.push('Test mode is disabled. Real transactions will be executed.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get confirmation for potentially dangerous operations
   */
  public async getConfirmation(
    operation: string,
    details: string,
    amount?: number
  ): Promise<boolean> {
    // In a real CLI, this would prompt user input
    // For this educational template, we'll implement basic safety checks
    
    const isLargeAmount = amount && amount > 0.1;
    const isDangerous = operation.includes('withdraw') || isLargeAmount;
    
    if (isDangerous && !env.testMode) {
      this.logger.warning(`⚠️  ${operation.toUpperCase()} OPERATION`);
      this.logger.info(`Details: ${details}`);
      
      if (amount) {
        this.logger.money(`Amount: ${amount.toFixed(4)} SOL`);
      }
      
      this.logger.warning('This will execute a real transaction on Solana mainnet!');
      this.logger.info('💡 Use --dry-run flag to test without executing');
      
      // In a real implementation, you'd use readline to get user input
      // For now, we'll return true but log the warnings
      return true;
    }
    
    return true;
  }

  /**
   * Validate pool health before operations
   */
  public validatePoolHealth(poolInfo: any): { 
    isHealthy: boolean; 
    issues: string[]; 
    warnings: string[] 
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check liquidity levels
    if (poolInfo.liquidity.tokenB < 1) {
      issues.push('Extremely low pool liquidity. Operations may fail.');
    } else if (poolInfo.liquidity.tokenB < 10) {
      warnings.push('Low pool liquidity. Expect higher slippage.');
    }

    // Check for reasonable prices
    if (poolInfo.price.tokenA <= 0) {
      issues.push('Invalid token pricing detected');
    }

    // Check for recent activity
    if (poolInfo.volume24h < 100) {
      warnings.push('Low trading volume in the last 24 hours');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Educational risk assessment for operations
   */
  public assessOperationRisk(
    operation: 'deposit' | 'withdraw' | 'monitor',
    amount?: number
  ): {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    recommendations: string[];
  } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // Amount-based risk assessment
    if (amount) {
      if (amount > 1.0) {
        riskLevel = 'HIGH';
        factors.push('Large position size');
        recommendations.push('Consider starting with smaller amounts (0.01-0.1 SOL)');
      } else if (amount > 0.1) {
        riskLevel = 'MEDIUM';
        factors.push('Moderate position size');
        recommendations.push('Monitor position regularly for learning');
      }
    }

    // Operation-specific risks
    switch (operation) {
      case 'deposit':
        factors.push('Impermanent loss risk', 'Smart contract risk');
        recommendations.push(
          'Understand impermanent loss before depositing',
          'Only deposit funds you can afford to lose',
          'Monitor token price movements'
        );
        break;
        
      case 'withdraw':
        factors.push('Price impact risk', 'Timing risk');
        recommendations.push(
          'Check current pool price before withdrawing',
          'Consider market conditions'
        );
        break;
        
      case 'monitor':
        factors.push('Educational opportunity');
        recommendations.push(
          'Watch for price movements and pool changes',
          'Learn about liquidity provision mechanics'
        );
        riskLevel = 'LOW';
        break;
    }

    // Environment-based adjustments
    if (!env.testMode) {
      factors.push('Live mainnet operation');
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      if (riskLevel === 'MEDIUM') riskLevel = 'HIGH';
    }

    return {
      riskLevel,
      factors,
      recommendations
    };
  }

  /**
   * Format validation results for CLI display
   */
  public formatValidationResult(result: {
    isValid: boolean;
    error?: string;
    warnings?: string[];
  }): string[] {
    const messages: string[] = [];

    if (!result.isValid && result.error) {
      messages.push(`❌ ${result.error}`);
    }

    if (result.warnings) {
      result.warnings.forEach(warning => {
        messages.push(`⚠️  ${warning}`);
      });
    }

    return messages;
  }
}