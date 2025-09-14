#!/usr/bin/env node

import { Command } from 'commander';
import { Connection } from '@solana/web3.js';
import { LoggerService } from './services/logger.service.js';
import { WalletService } from './services/wallet.service.js';
import { RaydiumService } from './services/raydium.service.js';
import { TokenService } from './services/token.service.js';
import { TransactionService } from './services/transaction.service.js';
import { ErrorHandlerService } from './services/error-handler.service.js';
import { ValidationService } from './services/validation.service.js';
import { env } from './config/environment.js';
import { POOL_CONFIG, DEFAULT_CONFIG } from './config/constants.js';
import { formatSOL, formatUSD, formatPercentage, formatToken, sleep } from './utils/helpers.js';
import type { CliOptions } from './types/index.js';

const program = new Command();

/**
 * Comprehensive service container
 */
interface Services {
  connection: Connection;
  logger: LoggerService;
  wallet: WalletService;
  tokenService: TokenService;
  transactionService: TransactionService;
  errorHandler: ErrorHandlerService;
  validator: ValidationService;
  raydium: RaydiumService;
}

/**
 * Initialize all services with proper dependency injection
 */
async function initializeServices(verbose: boolean = false): Promise<Services> {
  const logger = new LoggerService(verbose);

  try {
    // Show startup banner
    logger.header('Initialization');

    // Validate environment first
    logger.progress('Validating configuration');
    const wallet = new WalletService(logger);
    const validator = new ValidationService(logger, wallet);

    const envValidation = validator.validateEnvironment();
    if (!envValidation.isValid) {
      logger.progressFail();
      envValidation.errors.forEach(error => logger.error(error));
      throw new Error('Environment configuration invalid');
    }

    // Show warnings
    envValidation.warnings.forEach(warning => logger.warning(warning));
    logger.progressComplete();

    // Create connection with proper configuration
    logger.progress('Connecting to Solana RPC');
    const connection = new Connection(env.rpcUrl, {
      commitment: env.commitmentLevel,
      confirmTransactionInitialTimeout: env.rpcTimeoutMs,
      httpHeaders: {
        'User-Agent': 'Ray Tracer Educational Template v1.0'
      }
    });

    // Test connection
    try {
      const latestBlockhash = await connection.getLatestBlockhash();
      const slot = await connection.getSlot();
      logger.progressComplete();
      logger.verbose(`Connected to slot ${slot}, commitment: ${env.commitmentLevel}`);
    } catch (error) {
      logger.progressFail();
      throw new Error(`Failed to connect to Solana RPC: ${error}`);
    }

    // Initialize services in dependency order
    logger.progress('Initializing services');

    const errorHandler = new ErrorHandlerService(logger);
    const tokenService = new TokenService(connection, wallet, logger);
    const transactionService = new TransactionService(connection, logger);

    const raydium = new RaydiumService(
      connection,
      wallet,
      logger,
      tokenService,
      transactionService,
      errorHandler
    );

    // Initialize Raydium SDK
    await raydium.initialize();
    logger.progressComplete();

    // Show configuration summary if verbose
    if (verbose) {
      logger.separator();
      logger.info('Configuration Summary:');
      const configLines = env.getSummary().split('\n');
      configLines.forEach(line => logger.verbose(line));
      logger.separator();
    }

    return {
      connection,
      logger,
      wallet,
      tokenService,
      transactionService,
      errorHandler,
      validator,
      raydium
    };

  } catch (error) {
    const logger = new LoggerService(verbose);
    const errorHandler = new ErrorHandlerService(logger);
    const errorInfo = errorHandler.handleError(error, 'Service Initialization');

    logger.error('🚨 Failed to initialize Ray Tracer');
    logger.error(errorHandler.getDisplayMessage(errorInfo));
    process.exit(1);
  }
}

/**
 * Enhanced deposit command handler with comprehensive validation
 */
async function depositCommand(amount: string, options: CliOptions): Promise<void> {
  let services: Services;

  try {
    services = await initializeServices(options.verbose);
    const { logger, validator, raydium, wallet, errorHandler } = services;

    logger.header('Deposit Liquidity');

    // Step 1: Validate input amount
    const validation = await validator.validateDepositAmount(amount);
    if (!validation.isValid) {
      logger.error(validation.error!);
      process.exit(1);
    }

    // Show validation warnings
    if (validation.warnings) {
      validation.warnings.forEach(warning => logger.warning(warning));
    }

    const depositAmount = validation.amount!;

    // Step 2: Show wallet and pool info
    logger.info(`Wallet: ${wallet.getAddress()}`);
    const balance = await wallet.getBalance(services.connection);
    logger.money(`Balance: ${formatSOL(balance)}`);

    // Get pool info and validate health
    const poolInfo = await raydium.getPoolInfo();
    logger.pool(`Pool: ${POOL_CONFIG.POOL_NAME}`);
    logger.chart(`NECK Price: ${formatUSD(poolInfo.price.tokenA, 6)}`);
    logger.liquidity(`Pool Liquidity: ${formatUSD(poolInfo.liquidity.tokenB)}`);

    const poolHealth = validator.validatePoolHealth(poolInfo);
    if (!poolHealth.isHealthy) {
      poolHealth.issues.forEach(issue => logger.error(issue));
      logger.error('Pool health check failed. Aborting operation.');
      process.exit(1);
    }

    poolHealth.warnings.forEach(warning => logger.warning(warning));

    // Step 3: Risk assessment
    const riskAssessment = validator.assessOperationRisk('deposit', depositAmount);
    logger.info(`Risk Level: ${riskAssessment.riskLevel}`);

    if (riskAssessment.riskLevel === 'HIGH') {
      logger.warning('⚠️  HIGH RISK OPERATION DETECTED');
      riskAssessment.factors.forEach(factor => logger.warning(`• ${factor}`));
      logger.info('💡 Recommendations:');
      riskAssessment.recommendations.forEach(rec => logger.info(`• ${rec}`));
    }

    // Step 4: Handle dry run
    if (options.dryRun) {
      logger.warning('🧪 DRY RUN MODE - No transactions will be executed');
      logger.success('✓ All validations passed');
      logger.success('✓ Pool is accessible and healthy');
      logger.success('✓ Wallet has sufficient balance');
      logger.success('Dry run completed successfully - operation would proceed');
      return;
    }

    // Step 5: Get user confirmation for risky operations
    const shouldProceed = await validator.getConfirmation(
      'deposit liquidity',
      `${formatSOL(depositAmount)} worth to ${POOL_CONFIG.POOL_NAME} pool`,
      depositAmount
    );

    if (!shouldProceed) {
      logger.info('Operation cancelled by user');
      return;
    }

    // Step 6: Execute transaction
    logger.separator();
    logger.progress(`Depositing ${formatSOL(depositAmount)} worth of liquidity`);

    const result = await raydium.depositLiquidity({
      amount: depositAmount,
      slippage: options.slippage || env.slippageTolerance
    });

    if (result.success) {
      logger.progressComplete();
      logger.success(`Successfully deposited ${formatSOL(depositAmount)} worth of liquidity`);
      if (result.signature) {
        logger.transaction(result.signature);
      }

      // Educational message
      logger.separator();
      logger.info('🎓 Educational Note:');
      logger.info('You are now providing liquidity to the NECK-SOL pool.');
      logger.info('Monitor your position to learn about:');
      logger.info('• Price movements and impermanent loss');
      logger.info('• Fee earnings from trading volume');
      logger.info('• Liquidity pool mechanics');
      logger.info('Use "bun start monitor" to watch your position in real-time.');

    } else {
      logger.progressFail();
      const errorInfo = errorHandler.handleCommonDefiErrors(new Error(result.error || 'Unknown error'));
      logger.error(errorHandler.getDisplayMessage(errorInfo));
      process.exit(1);
    }

  } catch (error) {
    if (services!) {
      const errorInfo = services.errorHandler.handleError(error, 'Deposit Operation');
      services.logger.error('Deposit operation failed');
      services.logger.error(services.errorHandler.getDisplayMessage(errorInfo));
    } else {
      console.error(`❌ Critical error during deposit: ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Withdraw command handler
 */
async function withdrawCommand(options: CliOptions): Promise<void> {
  let services: Services;

  try {
    services = await initializeServices(options.verbose);
    const { logger, connection, wallet, raydium } = services;

    logger.header('Withdraw Liquidity');

    // Show wallet info
    logger.info(`Wallet: ${wallet.getAddress()}`);

    // Check position
    const position = await raydium.getLiquidityPosition();
    if (!position) {
      logger.warning('No liquidity position found');
      return;
    }

    logger.money(`Current Position Value: ${formatUSD(position.valueUSD)}`);
    logger.lightning(`LP Tokens: ${formatToken(position.lpTokenBalance, 'LP', 6)}`);

    if (options.dryRun) {
      logger.warning('DRY RUN - No transactions will be executed');
      logger.success('Dry run completed successfully');
      return;
    }

    // Execute withdrawal
    const result = await raydium.withdrawLiquidity();

    if (result.success) {
      logger.success('Successfully withdrew all liquidity');
    } else {
      logger.error(`Withdrawal failed: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    if (services!) {
      const errorInfo = services.errorHandler.handleError(error, 'Withdraw Operation');
      services.logger.error('Withdraw operation failed');
      services.logger.error(services.errorHandler.getDisplayMessage(errorInfo));
    } else {
      console.error(`❌ Critical error during withdraw: ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Status command handler
 */
async function statusCommand(options: CliOptions): Promise<void> {
  let services: Services;

  try {
    services = await initializeServices(options.verbose);
    const { logger, connection, wallet, raydium } = services;

    logger.header('Position Status');

    // Wallet info
    const balance = await wallet.getBalance(connection);
    logger.info(`Wallet: ${wallet.getAddress()}`);
    logger.money(`SOL Balance: ${formatSOL(balance)}`);

    logger.separator();

    // Pool info
    const poolInfo = await raydium.getPoolInfo();
    logger.pool(`Pool: ${POOL_CONFIG.POOL_NAME}`);
    logger.chart(`NECK Price: ${formatUSD(poolInfo.price.tokenA, 6)}`);
    logger.liquidity(`Total Liquidity: ${formatUSD(poolInfo.liquidity.tokenB)}`);

    if (poolInfo.volume24h) {
      logger.lightning(`24h Volume: ${formatUSD(poolInfo.volume24h)}`);
    }

    logger.separator();

    // Position info
    const position = await raydium.getLiquidityPosition();

    if (!position) {
      logger.warning('No liquidity position found');
      return;
    }

    logger.money(`LP Tokens: ${formatToken(position.lpTokenBalance, 'LP', 6)}`);
    logger.chart(`Position Value: ${formatUSD(position.valueUSD)}`);
    logger.info(`Pool Share: ${formatPercentage(position.share, 4)}`);
    logger.lightning(`NECK Amount: ${formatToken(position.tokenAAmount, 'NECK')}`);
    logger.lightning(`SOL Amount: ${formatSOL(position.tokenBAmount)}`);

    if (position.feesEarned) {
      logger.money(`Est. Fees Earned: ${formatUSD(position.feesEarned)}`);
    }

  } catch (error) {
    if (services!) {
      const errorInfo = services.errorHandler.handleError(error, 'Status Operation');
      services.logger.error('Status operation failed');
      services.logger.error(services.errorHandler.getDisplayMessage(errorInfo));
    } else {
      console.error(`❌ Critical error during status check: ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Monitor command handler
 */
async function monitorCommand(options: CliOptions): Promise<void> {
  let services: Services;

  try {
    services = await initializeServices(options.verbose);
    const { logger, connection, wallet, raydium } = services;

    logger.header('Position Monitor');
    logger.info('Starting position monitor... (Press Ctrl+C to stop)');
    logger.newline();

    let previousPrice = 0;
    let monitorCount = 0;

    const monitorLoop = async () => {
      try {
        monitorCount++;

        // Clear previous output (except first run)
        if (monitorCount > 1) {
          process.stdout.write('\x1b[6A'); // Move cursor up 6 lines
        }

        const timestamp = new Date().toLocaleTimeString();

        // Get current data
        const [poolInfo, position, networkStats] = await Promise.all([
          raydium.getPoolInfo(),
          raydium.getLiquidityPosition(),
          raydium.getNetworkStatus()
        ]);

        const currentPrice = poolInfo.price.tokenA;
        const priceChange = previousPrice > 0 ?
          ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

        // Display current status
        logger.search(`[${timestamp}] Position Monitor - Update #${monitorCount}`);
        logger.chart(`NECK Price: ${formatUSD(currentPrice, 6)} (${formatPercentage(priceChange)})`);
        logger.liquidity(`Pool Liquidity: ${formatUSD(poolInfo.liquidity.tokenB)}`);
        logger.info(`Network: Block ${networkStats.blockHeight} | TPS ~${networkStats.tps}`);

        if (position) {
          logger.money(`Position Value: ${formatUSD(position.valueUSD)}`);
          logger.lightning(`Pool Share: ${formatPercentage(position.share, 4)}`);
        } else {
          logger.warning('No position detected');
        }

        previousPrice = currentPrice;

        // Schedule next update
        setTimeout(monitorLoop, DEFAULT_CONFIG.MONITOR_INTERVAL_MS);

      } catch (error) {
        logger.error(`Monitor update failed: ${error}`);
        setTimeout(monitorLoop, DEFAULT_CONFIG.MONITOR_INTERVAL_MS * 2); // Retry with longer delay
      }
    };

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      logger.newline();
      logger.success('Monitor stopped by user');
      process.exit(0);
    });

    // Start monitoring
    await monitorLoop();

  } catch (error) {
    if (services!) {
      const errorInfo = services.errorHandler.handleError(error, 'Monitor Operation');
      services.logger.error('Monitor operation failed');
      services.logger.error(services.errorHandler.getDisplayMessage(errorInfo));
    } else {
      console.error(`❌ Critical error during monitoring: ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Configure CLI program
 */
program
  .name('ray-tracer')
  .description('Educational Raydium liquidity provision CLI for NECK-SOL pool')
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-d, --dry-run', 'Simulate operations without executing transactions')
  .option('-s, --slippage <percent>', 'Slippage tolerance percentage', env.slippageTolerance.toString());

// Deposit command
program
  .command('deposit <amount>')
  .description('Deposit SOL worth of liquidity to NECK-SOL pool')
  .action(depositCommand);

// Withdraw command
program
  .command('withdraw')
  .description('Withdraw all liquidity from NECK-SOL pool')
  .action(withdrawCommand);

// Status command
program
  .command('status')
  .description('Check current position and pool statistics')
  .action(statusCommand);

// Monitor command
program
  .command('monitor')
  .description('Monitor position with real-time updates')
  .action(monitorCommand);

// Parse arguments and run
program.parse();