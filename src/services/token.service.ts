import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  AccountLayout
} from '@solana/spl-token';
import { LoggerService } from './logger.service.js';
import { WalletService } from './wallet.service.js';
import type { TokenInfo, TokenBalance } from '../types/index.js';

/**
 * Token service for handling SPL tokens and WSOL operations
 * Provides proper decimal handling and token account management
 */
export class TokenService {
  private connection: Connection;
  private wallet: WalletService;
  private logger: LoggerService;
  private tokenCache: Map<string, TokenInfo> = new Map();

  constructor(connection: Connection, wallet: WalletService, logger: LoggerService) {
    this.connection = connection;
    this.wallet = wallet;
    this.logger = logger;
  }

  /**
   * Get token information including decimals
   */
  public async getTokenInfo(mint: PublicKey): Promise<TokenInfo> {
    const mintStr = mint.toString();
    
    // Check cache first
    if (this.tokenCache.has(mintStr)) {
      return this.tokenCache.get(mintStr)!;
    }

    try {
      // Handle WSOL specially
      if (mint.equals(NATIVE_MINT)) {
        const tokenInfo: TokenInfo = {
          mint,
          decimals: 9,
          symbol: 'SOL',
          name: 'Wrapped SOL',
          isNative: true
        };
        this.tokenCache.set(mintStr, tokenInfo);
        return tokenInfo;
      }

      // Get mint account info
      const mintInfo = await this.connection.getParsedAccountInfo(mint);
      
      if (!mintInfo.value || !mintInfo.value.data) {
        throw new Error(`Token mint not found: ${mint.toString()}`);
      }

      const parsedData = mintInfo.value.data as any;
      if (parsedData.program !== 'spl-token' || !parsedData.parsed) {
        throw new Error(`Invalid token mint: ${mint.toString()}`);
      }

      const tokenInfo: TokenInfo = {
        mint,
        decimals: parsedData.parsed.info.decimals,
        symbol: this.getTokenSymbol(mint),
        name: this.getTokenName(mint),
        isNative: false,
        supply: parsedData.parsed.info.supply ? 
          parseFloat(parsedData.parsed.info.supply) / Math.pow(10, parsedData.parsed.info.decimals) : 
          0
      };

      this.tokenCache.set(mintStr, tokenInfo);
      return tokenInfo;

    } catch (error) {
      this.logger.error(`Failed to get token info for ${mint.toString()}: ${error}`);
      throw error;
    }
  }

  /**
   * Get token balance for a specific mint
   */
  public async getTokenBalance(mint: PublicKey, owner?: PublicKey): Promise<TokenBalance> {
    const ownerKey = owner || this.wallet.getPublicKey();
    
    try {
      // Handle SOL balance
      if (mint.equals(NATIVE_MINT)) {
        const balance = await this.connection.getBalance(ownerKey);
        return {
          mint,
          owner: ownerKey,
          amount: balance,
          decimals: 9,
          uiAmount: balance / LAMPORTS_PER_SOL
        };
      }

      // Get associated token account
      const tokenAccount = await getAssociatedTokenAddress(mint, ownerKey);
      
      try {
        const tokenAccountInfo = await this.connection.getParsedAccountInfo(tokenAccount);
        
        if (!tokenAccountInfo.value || !tokenAccountInfo.value.data) {
          return {
            mint,
            owner: ownerKey,
            amount: 0,
            decimals: 9,
            uiAmount: 0
          };
        }

        const parsedData = tokenAccountInfo.value.data as any;
        const tokenAmount = parsedData.parsed.info.tokenAmount;

        return {
          mint,
          owner: ownerKey,
          amount: parseInt(tokenAmount.amount),
          decimals: tokenAmount.decimals,
          uiAmount: parseFloat(tokenAmount.uiAmountString || '0')
        };

      } catch (error) {
        // Token account doesn't exist
        return {
          mint,
          owner: ownerKey,
          amount: 0,
          decimals: 9,
          uiAmount: 0
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get token balance: ${error}`);
      throw error;
    }
  }

  /**
   * Create WSOL account and wrap SOL
   */
  public async wrapSOL(amount: number): Promise<{ transaction: Transaction; wsolAccount: PublicKey }> {
    try {
      this.logger.verbose(`Wrapping ${amount} SOL to WSOL`);
      
      const transaction = new Transaction();
      const owner = this.wallet.getPublicKey();
      
      // Get associated WSOL account
      const wsolAccount = await getAssociatedTokenAddress(NATIVE_MINT, owner);
      
      // Check if WSOL account exists
      const wsolAccountInfo = await this.connection.getAccountInfo(wsolAccount);
      
      if (!wsolAccountInfo) {
        // Create associated token account for WSOL
        const createAccountIx = createAssociatedTokenAccountInstruction(
          owner, // payer
          wsolAccount, // associated token account
          owner, // owner
          NATIVE_MINT // mint
        );
        transaction.add(createAccountIx);
      }

      // Transfer SOL to WSOL account
      const transferIx = SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: wsolAccount,
        lamports: amount * LAMPORTS_PER_SOL
      });
      transaction.add(transferIx);

      // Sync native (convert SOL to WSOL)
      const syncIx = createSyncNativeInstruction(wsolAccount);
      transaction.add(syncIx);

      return { transaction, wsolAccount };

    } catch (error) {
      this.logger.error(`Failed to wrap SOL: ${error}`);
      throw error;
    }
  }

  /**
   * Unwrap WSOL back to SOL
   */
  public async unwrapSOL(): Promise<Transaction> {
    try {
      this.logger.verbose('Unwrapping WSOL to SOL');
      
      const transaction = new Transaction();
      const owner = this.wallet.getPublicKey();
      
      // Get associated WSOL account
      const wsolAccount = await getAssociatedTokenAddress(NATIVE_MINT, owner);
      
      // Check if account exists and has balance
      const balance = await this.getTokenBalance(NATIVE_MINT);
      
      if (balance.amount === 0) {
        throw new Error('No WSOL balance to unwrap');
      }

      // Close the WSOL account (automatically unwraps to SOL)
      const closeIx = createCloseAccountInstruction(
        wsolAccount, // account to close
        owner, // destination for remaining SOL
        owner // owner
      );
      transaction.add(closeIx);

      return transaction;

    } catch (error) {
      this.logger.error(`Failed to unwrap WSOL: ${error}`);
      throw error;
    }
  }

  /**
   * Check if user has sufficient token balance
   */
  public async hasSufficientBalance(
    mint: PublicKey, 
    requiredAmount: number, 
    owner?: PublicKey
  ): Promise<boolean> {
    try {
      const balance = await this.getTokenBalance(mint, owner);
      return balance.uiAmount >= requiredAmount;
    } catch (error) {
      this.logger.error(`Failed to check token balance: ${error}`);
      return false;
    }
  }

  /**
   * Convert raw token amount to UI amount using decimals
   */
  public rawToUi(rawAmount: number | string, decimals: number): number {
    const amount = typeof rawAmount === 'string' ? parseInt(rawAmount) : rawAmount;
    return amount / Math.pow(10, decimals);
  }

  /**
   * Convert UI amount to raw token amount using decimals
   */
  public uiToRaw(uiAmount: number, decimals: number): number {
    return Math.floor(uiAmount * Math.pow(10, decimals));
  }

  /**
   * Get all token accounts for owner
   */
  public async getAllTokenBalances(owner?: PublicKey): Promise<TokenBalance[]> {
    const ownerKey = owner || this.wallet.getPublicKey();
    const balances: TokenBalance[] = [];

    try {
      // Get SOL balance first
      const solBalance = await this.getTokenBalance(NATIVE_MINT, ownerKey);
      balances.push(solBalance);

      // Get all token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        ownerKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      for (const { account } of tokenAccounts.value) {
        const parsedData = account.data as any;
        const tokenAmount = parsedData.parsed.info.tokenAmount;
        const mint = new PublicKey(parsedData.parsed.info.mint);

        // Skip if balance is zero
        if (parseInt(tokenAmount.amount) === 0) continue;

        balances.push({
          mint,
          owner: ownerKey,
          amount: parseInt(tokenAmount.amount),
          decimals: tokenAmount.decimals,
          uiAmount: parseFloat(tokenAmount.uiAmountString || '0')
        });
      }

      return balances;

    } catch (error) {
      this.logger.error(`Failed to get all token balances: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate minimum required balance for operations
   */
  public calculateMinimumBalance(
    operations: Array<{ mint: PublicKey; amount: number }>,
    includeRent: boolean = true
  ): number {
    let totalSOL = 0;

    // Add operation amounts for SOL
    for (const op of operations) {
      if (op.mint.equals(NATIVE_MINT)) {
        totalSOL += op.amount;
      }
    }

    // Add rent exemption for token accounts if needed
    if (includeRent) {
      totalSOL += 0.00203928; // Rent for token account
    }

    // Add transaction fees (estimate)
    totalSOL += 0.001;

    return totalSOL;
  }

  /**
   * Get token symbol (hardcoded for known tokens)
   */
  private getTokenSymbol(mint: PublicKey): string {
    const mintStr = mint.toString();
    
    // Known token symbols
    const knownTokens: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'BByRYGw5yrSQpPXFYoy7euzwtxwkbKz8JpQwz9sgpump': 'NECK',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT'
    };

    return knownTokens[mintStr] || 'UNKNOWN';
  }

  /**
   * Get token name (hardcoded for known tokens)
   */
  private getTokenName(mint: PublicKey): string {
    const mintStr = mint.toString();
    
    // Known token names
    const knownTokens: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'Solana',
      'BByRYGw5yrSQpPXFYoy7euzwtxwkbKz8JpQwz9sgpump': 'NECK Token',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD'
    };

    return knownTokens[mintStr] || 'Unknown Token';
  }

  /**
   * Validate token mint address
   */
  public static isValidMint(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear token info cache
   */
  public clearCache(): void {
    this.tokenCache.clear();
  }
}