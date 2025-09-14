import {
  Connection,
  Transaction,
  VersionedTransaction,
  TransactionSignature,
  SendOptions,
  Commitment,
  ComputeBudgetProgram,
  TransactionMessage
} from '@solana/web3.js';
import { env } from '../config/environment.js';
import { LoggerService } from './logger.service.js';
import { sleep } from '../utils/helpers.js';
import type { TransactionResult } from '../types/index.js';

/**
 * Enhanced transaction service with robust confirmation handling
 * Handles transaction simulation, sending, and confirmation with retries
 */
export class TransactionService {
  private connection: Connection;
  private logger: LoggerService;

  constructor(connection: Connection, logger: LoggerService) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Send and confirm transaction with comprehensive error handling
   */
  public async sendAndConfirmTransaction(
    transaction: Transaction | VersionedTransaction,
    options: {
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
      maxRetries?: number;
      skipConfirmation?: boolean;
    } = {}
  ): Promise<TransactionResult> {
    const maxRetries = options.maxRetries || env.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.verbose(`Transaction attempt ${attempt}/${maxRetries}`);

        // Simulate transaction first
        if (!options.skipPreflight) {
          const simulationResult = await this.simulateTransaction(transaction);
          if (!simulationResult.success) {
            throw new Error(`Simulation failed: ${simulationResult.error}`);
          }
        }

        // Send transaction
        const signature = await this.sendTransaction(transaction, {
          skipPreflight: options.skipPreflight ?? false,
          preflightCommitment: options.preflightCommitment ?? 'confirmed'
        });

        this.logger.verbose(`Transaction sent: ${signature}`);

        // Skip confirmation if requested (for testing)
        if (options.skipConfirmation) {
          return {
            success: true,
            signature
          };
        }

        // Wait for confirmation
        const confirmed = await this.confirmTransaction(signature);

        if (confirmed) {
          this.logger.verbose(`Transaction confirmed: ${signature}`);
          return {
            success: true,
            signature
          };
        } else {
          throw new Error('Transaction failed to confirm within timeout');
        }

      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.verbose(`Retry ${attempt} failed: ${error}. Waiting ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Transaction failed after ${maxRetries} attempts: ${lastError?.message}`
    };
  }

  /**
   * Simulate transaction to check for errors
   */
  public async simulateTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    try {
      this.logger.verbose('Simulating transaction...');

      const result = await this.connection.simulateTransaction(
        transaction as VersionedTransaction,
        {
          commitment: env.commitmentLevel,
          sigVerify: false
        }
      );

      if (result.value.err) {
        const errorMsg = this.parseTransactionError(result.value.err);
        this.logger.verbose(`Simulation failed: ${errorMsg}`);

        return {
          success: false,
          error: errorMsg,
          logs: result.value.logs || []
        };
      }

      this.logger.verbose(`Simulation successful. Compute units: ${result.value.unitsConsumed || 'unknown'}`);

      return {
        success: true,
        logs: result.value.logs || []
      };

    } catch (error) {
      this.logger.verbose(`Simulation error: ${error}`);
      return {
        success: false,
        error: `Simulation failed: ${error}`
      };
    }
  }

  /**
   * Send transaction to the network
   */
  private async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options: SendOptions = {}
  ): Promise<TransactionSignature> {
    const sendOptions: SendOptions = {
      skipPreflight: options.skipPreflight || false,
      preflightCommitment: options.preflightCommitment || env.commitmentLevel,
      maxRetries: 0, // We handle retries at a higher level
      ...options
    };

    if (transaction instanceof Transaction) {
      return await this.connection.sendTransaction(transaction, [], sendOptions);
    } else {
      return await this.connection.sendRawTransaction(transaction.serialize(), sendOptions);
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  private async confirmTransaction(
    signature: TransactionSignature,
    timeoutMs: number = 60000
  ): Promise<boolean> {
    try {
      this.logger.verbose(`Waiting for transaction confirmation: ${signature}`);

      const startTime = Date.now();
      const latestBlockhash = await this.connection.getLatestBlockhash(env.commitmentLevel);

      // Use the newer confirmTransaction method
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, env.commitmentLevel);

      const elapsed = Date.now() - startTime;
      this.logger.verbose(`Confirmation took ${elapsed}ms`);

      return !confirmation.value.err;

    } catch (error) {
      this.logger.verbose(`Confirmation error: ${error}`);
      return false;
    }
  }

  /**
   * Add compute budget instructions for priority fees
   */
  public addComputeBudgetInstructions(transaction: Transaction): Transaction {
    if (env.priorityFeeMicroLamports > 0) {
      const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: env.priorityFeeMicroLamports
      });

      // Add reasonable compute unit limit
      const computeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000
      });

      transaction.instructions.unshift(computeLimitIx, computePriceIx);
    }

    return transaction;
  }

  /**
   * Get transaction status and details
   */
  public async getTransactionStatus(signature: TransactionSignature): Promise<{
    confirmed: boolean;
    slot?: number;
    err?: any;
    confirmations?: number;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      if (!status.value) {
        return { confirmed: false };
      }

      const result: { confirmed: boolean; slot?: number; err?: any; confirmations?: number } = {
        confirmed: status.value.confirmationStatus === 'confirmed' ||
          status.value.confirmationStatus === 'finalized'
      };

      if (status.value.slot !== null) {
        result.slot = status.value.slot;
      }

      if (status.value.err !== null) {
        result.err = status.value.err;
      }

      if (status.value.confirmations !== null) {
        result.confirmations = status.value.confirmations;
      }

      return result;

    } catch (error) {
      this.logger.verbose(`Error getting transaction status: ${error}`);
      return { confirmed: false };
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = env.retryBaseDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const maxDelay = 30000; // Max 30 seconds

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;

    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Parse Solana transaction error into human-readable message
   */
  private parseTransactionError(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      // Handle instruction errors
      if ('InstructionError' in error && Array.isArray(error.InstructionError)) {
        const [instructionIndex, instructionError] = error.InstructionError;

        if (typeof instructionError === 'object') {
          if ('Custom' in instructionError) {
            return `Instruction ${instructionIndex} failed with custom error ${instructionError.Custom}`;
          }

          const errorType = Object.keys(instructionError)[0];
          return `Instruction ${instructionIndex} failed: ${errorType}`;
        }

        return `Instruction ${instructionIndex} failed: ${instructionError}`;
      }

      // Handle other error types
      const errorType = Object.keys(error)[0];
      return `Transaction failed: ${errorType}`;
    }

    return `Unknown transaction error: ${JSON.stringify(error)}`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network-related errors that are worth retrying
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'fetch',
      'econnreset',
      'enotfound',
      'blockhash not found',
      '429', // Rate limited
      'internal server error',
      'service unavailable'
    ];

    return retryableErrors.some(retryableError =>
      message.includes(retryableError)
    );
  }

  /**
   * Estimate transaction fees
   */
  public async estimateTransactionFee(
    transaction: Transaction | VersionedTransaction
  ): Promise<{ baseFee: number; priorityFee: number; total: number }> {
    try {
      const feeCalculator = await this.connection.getFeeForMessage(
        transaction instanceof Transaction
          ? transaction.compileMessage()
          : transaction.message,
        env.commitmentLevel
      );

      const baseFee = feeCalculator.value || 5000; // Fallback to 5000 lamports
      const priorityFee = env.priorityFeeMicroLamports;

      return {
        baseFee,
        priorityFee,
        total: baseFee + priorityFee
      };

    } catch (error) {
      this.logger.verbose(`Fee estimation failed: ${error}`);

      // Return conservative estimates
      return {
        baseFee: 5000,
        priorityFee: env.priorityFeeMicroLamports,
        total: 5000 + env.priorityFeeMicroLamports
      };
    }
  }
}