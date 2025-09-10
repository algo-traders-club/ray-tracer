import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { env } from '../config/environment.js';
import { LoggerService } from './logger.service.js';

/**
 * Wallet service for secure private key management and wallet operations
 * Handles keypair creation, balance checking, and wallet utilities
 */
export class WalletService {
  private keypair: Keypair;
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.keypair = this.createKeypairFromPrivateKey(env.privateKey);
  }

  /**
   * Create Keypair from base58 encoded private key
   * Supports both array format and base58 string format
   */
  private createKeypairFromPrivateKey(privateKey: string): Keypair {
    try {
      // Try parsing as base58 first (most common format)
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    } catch (error) {
      // If base58 fails, try parsing as JSON array
      try {
        const keyArray = JSON.parse(privateKey);
        if (Array.isArray(keyArray) && keyArray.length === 64) {
          return Keypair.fromSecretKey(new Uint8Array(keyArray));
        }
        throw new Error('Invalid array format');
      } catch {
        throw new Error(
          'Invalid private key format. Expected base58 encoded string or 64-byte array.'
        );
      }
    }
  }

  /**
   * Get the wallet's public key
   */
  public getPublicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  /**
   * Get the wallet's keypair (use carefully)
   */
  public getKeypair(): Keypair {
    return this.keypair;
  }

  /**
   * Get SOL balance for the wallet
   */
  public async getBalance(connection: Connection): Promise<number> {
    try {
      const balance = await connection.getBalance(this.keypair.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error(`Failed to fetch wallet balance: ${error}`);
      throw error;
    }
  }

  /**
   * Check if wallet has sufficient SOL balance for transaction
   */
  public async hasSufficientBalance(
    connection: Connection, 
    requiredSOL: number,
    includeRentExemption: boolean = true
  ): Promise<boolean> {
    try {
      const balance = await this.getBalance(connection);
      
      // Add rent exemption (~0.002 SOL) and transaction fees (~0.001 SOL)
      const bufferSOL = includeRentExemption ? 0.003 : 0.001;
      const totalRequired = requiredSOL + bufferSOL;
      
      return balance >= totalRequired;
    } catch (error) {
      this.logger.error(`Failed to check wallet balance: ${error}`);
      return false;
    }
  }

  /**
   * Get wallet address as string
   */
  public getAddress(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Validate if a given string is a valid Solana address
   */
  public static isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get wallet summary for logging
   */
  public async getWalletSummary(connection: Connection): Promise<string> {
    try {
      const address = this.getAddress();
      const balance = await this.getBalance(connection);
      
      return [
        `Address: ${address}`,
        `Balance: ${balance.toFixed(4)} SOL`
      ].join('\n');
    } catch (error) {
      return `Address: ${this.getAddress()}\nBalance: Error fetching balance`;
    }
  }

  /**
   * Convert lamports to SOL
   */
  public static lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Convert SOL to lamports
   */
  public static solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }
}