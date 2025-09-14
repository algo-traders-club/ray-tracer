import { Connection, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
import { Raydium, TxVersion, parseTokenAccountResp, toTokenAmount } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { TOKEN_MINTS, POOL_CONFIG, DEFAULT_CONFIG } from '../config/constants.js';
import { env } from '../config/environment.js';
import { LoggerService } from './logger.service.js';
import { WalletService } from './wallet.service.js';
import { TokenService } from './token.service.js';
import { TransactionService } from './transaction.service.js';
import { ErrorHandlerService } from './error-handler.service.js';
import type { PoolInfo, LiquidityPosition, TransactionResult, DepositParams, RiskMetrics } from '../types/index.js';

/**
 * Raydium service for interacting with the NECK-SOL liquidity pool
 * Handles pool data fetching, liquidity provision, and position management
 */
export class RaydiumService {
  private connection: Connection;
  private raydium!: Raydium;
  private logger: LoggerService;
  private wallet: WalletService;
  private tokenService: TokenService;
  private transactionService: TransactionService;
  private errorHandler: ErrorHandlerService;
  private poolCache: Map<string, PoolInfo> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    connection: Connection,
    wallet: WalletService,
    logger: LoggerService,
    tokenService: TokenService,
    transactionService: TransactionService,
    errorHandler: ErrorHandlerService
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.logger = logger;
    this.tokenService = tokenService;
    this.transactionService = transactionService;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize Raydium SDK
   */
  public async initialize(): Promise<void> {
    this.logger.progress('Initializing Raydium SDK');
    this.raydium = await Raydium.load({
      owner: this.wallet.getKeypair(),
      connection: this.connection,
      cluster: 'mainnet'
    });
    this.logger.progressComplete();
  }

  /**
   * Get pool information for NECK-SOL with caching and proper error handling
   */
  public async getPoolInfo(useCache: boolean = true): Promise<PoolInfo> {
    const poolId = POOL_CONFIG.POOL_ID;
    const now = Date.now();

    try {
      // Check cache first
      if (useCache && this.poolCache.has(poolId) &&
        (now - this.lastCacheUpdate) < this.CACHE_TTL) {
        this.logger.verbose('Using cached pool info');
        return this.poolCache.get(poolId)!;
      }

      this.logger.verbose('Fetching fresh pool info from Raydium API');

      // Try multiple methods to get pool data
      let poolData;

      try {
        // Method 1: Use Raydium API
        const apiData = await this.raydium.api.fetchPoolById({
          ids: poolId
        });

        if (apiData && apiData.length > 0) {
          poolData = apiData[0];
        }
      } catch (apiError) {
        this.logger.verbose(`API fetch failed: ${apiError}`);
      }

      if (!poolData) {
        // Method 2: Fallback to direct pool account fetch
        poolData = await this.fetchPoolDataDirect();
      }

      if (!poolData) {
        throw new Error(`Pool ${POOL_CONFIG.POOL_NAME} not found or inaccessible`);
      }

      // Get token info for proper decimal handling
      const [tokenAInfo, tokenBInfo] = await Promise.all([
        this.tokenService.getTokenInfo(TOKEN_MINTS.NECK),
        this.tokenService.getTokenInfo(TOKEN_MINTS.WSOL)
      ]);

      const poolInfo: PoolInfo = {
        poolId: new PublicKey(poolId),
        tokenA: TOKEN_MINTS.NECK,
        tokenB: TOKEN_MINTS.WSOL,
        lpToken: new PublicKey(poolData.lpMint || poolData.lpToken || ''),
        liquidity: {
          tokenA: this.tokenService.rawToUi(
            parseFloat(poolData.baseReserve || '0'),
            tokenAInfo.decimals
          ),
          tokenB: this.tokenService.rawToUi(
            parseFloat(poolData.quoteReserve || '0'),
            tokenBInfo.decimals
          ),
          total: parseFloat(poolData.lpSupply || '0')
        },
        price: {
          tokenA: parseFloat(poolData.price || '0'),
          tokenB: parseFloat(poolData.price || '0') > 0 ?
            1 / parseFloat(poolData.price) : 0
        },
        fees24h: this.calculateFees24h(poolData),
        volume24h: parseFloat(poolData.day?.volumeQuote ||
          poolData.volume24h ||
          poolData.dayVolume || '0')
      };

      // Cache the result
      this.poolCache.set(poolId, poolInfo);
      this.lastCacheUpdate = now;

      this.logger.verbose(`Pool info cached: ${poolInfo.liquidity.tokenB} SOL liquidity`);
      return poolInfo;

    } catch (error) {
      const errorInfo = this.errorHandler.handleError(error, 'getPoolInfo');
      throw new Error(`Failed to fetch pool info: ${errorInfo.message}`);
    }
  }

  /**
   * Fallback method to fetch pool data directly
   */
  private async fetchPoolDataDirect(): Promise<any> {
    try {
      // This is a simplified version - in reality you'd need to parse
      // the pool account data directly from the blockchain
      this.logger.verbose('Attempting direct pool data fetch...');

      const poolAccount = await this.connection.getAccountInfo(
        new PublicKey(POOL_CONFIG.POOL_ID)
      );

      if (!poolAccount) {
        return null;
      }

      // For now, return a basic structure
      // In a full implementation, you'd parse the account data
      return {
        lpMint: 'PLACEHOLDER_LP_MINT',
        baseReserve: '0',
        quoteReserve: '0',
        lpSupply: '0',
        price: '0'
      };

    } catch (error) {
      this.logger.verbose(`Direct pool fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Calculate 24h fees from pool data
   */
  private calculateFees24h(poolData: any): number {
    try {
      const feeA = parseFloat(poolData.day?.feeA || '0');
      const feeB = parseFloat(poolData.day?.feeB || '0');
      const totalFee = parseFloat(poolData.fees24h || '0');

      return totalFee || (feeA + feeB);
    } catch {
      return 0;
    }
  }

  /**
   * Get user's liquidity position
   */
  public async getLiquidityPosition(): Promise<LiquidityPosition | null> {
    try {
      const poolInfo = await this.getPoolInfo();

      // Get user's LP token balance
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        this.wallet.getPublicKey(),
        { mint: poolInfo.lpToken }
      );

      if (tokenAccounts.value.length === 0) {
        return null; // No position
      }

      if (!tokenAccounts.value[0]) {
        return null;
      }

      // TODO: Fix token account parsing - temporarily returning null
      // const accountData = tokenAccounts.value[0].account.data;
      // const tokenAccountInfo = parseTokenAccountResp({
      //   owner: this.wallet.getPublicKey(),
      //   tokenAccountResp: tokenAccounts.value[0]
      // });
      // const lpTokenBalance = tokenAccountInfo.tokenAccounts[0]?.amount.toNumber() || 0;
      const lpTokenBalance = 0; // Temporary

      if (lpTokenBalance === 0) {
        return null;
      }

      // Calculate position value
      const poolShare = lpTokenBalance / poolInfo.liquidity.total;
      const tokenAAmount = poolInfo.liquidity.tokenA * poolShare;
      const tokenBAmount = poolInfo.liquidity.tokenB * poolShare;

      // Estimate USD value (simplified calculation)
      const valueUSD = tokenBAmount; // Assuming WSOL ≈ $1 for simplification

      return {
        lpTokenBalance,
        valueUSD,
        tokenAAmount,
        tokenBAmount,
        share: poolShare * 100, // Convert to percentage
        impermanentLoss: 0, // Would need historical data
        feesEarned: 0 // Would need historical data
      };
    } catch (error) {
      this.logger.error(`Failed to fetch liquidity position: ${error}`);
      throw error;
    }
  }

  /**
   * Deposit liquidity to the pool
   */
  public async depositLiquidity(params: DepositParams): Promise<TransactionResult> {
    try {
      this.logger.progress(`Depositing ${params.amount} SOL worth of liquidity`);

      // Check wallet balance
      const hasSufficientBalance = await this.wallet.hasSufficientBalance(
        this.connection,
        params.amount
      );

      if (!hasSufficientBalance) {
        this.logger.progressFail();
        throw new Error('Insufficient SOL balance for deposit');
      }

      const poolInfo = await this.getPoolInfo();
      const slippage = params.slippage || env.slippageTolerance;

      // Calculate token amounts based on current pool ratio
      const solAmount = params.amount;
      const neckAmount = solAmount / poolInfo.price.tokenA;

      this.logger.verbose(`Calculated amounts - SOL: ${solAmount}, NECK: ${neckAmount}`);

      // Get token information for proper TokenAmount creation
      const neckToken = await this.tokenService.getTokenInfo(TOKEN_MINTS.NECK);
      const solToken = await this.tokenService.getTokenInfo(TOKEN_MINTS.WSOL);

      // Create proper TokenAmount objects
      const neckTokenAmount = toTokenAmount({
        mint: neckToken.mint,
        decimals: neckToken.decimals,
        symbol: neckToken.symbol,
        name: neckToken.name,
        isNative: neckToken.isNative,
        programId: TOKEN_MINTS.NECK,
        chainId: 101, // Solana mainnet
        address: neckToken.mint.toString(),
        logoURI: undefined,
        amount: neckAmount,
        isRaw: false
      });

      const solTokenAmount = toTokenAmount({
        mint: solToken.mint,
        decimals: solToken.decimals,
        symbol: solToken.symbol,
        name: solToken.name,
        isNative: solToken.isNative,
        programId: TOKEN_MINTS.WSOL,
        chainId: 101, // Solana mainnet
        address: solToken.mint.toString(),
        logoURI: undefined,
        amount: solAmount,
        isRaw: false
      });

      // Calculate minimum amounts with slippage
      const slippageMultiplier = 1 - (slippage / 100);
      const minNeckAmount = toTokenAmount({
        ...neckTokenAmount,
        amount: neckAmount * slippageMultiplier
      });

      // Create add liquidity instruction
      const { execute } = await this.raydium.liquidity.addLiquidity({
        poolInfo: poolInfo as any, // Type assertion for SDK compatibility
        amountInA: neckTokenAmount,
        amountInB: solTokenAmount,
        otherAmountMin: minNeckAmount,
        fixedSide: 'b', // Fix SOL amount
        txVersion: TxVersion.V0
      });

      // Execute transaction
      const { txId } = await execute();

      this.logger.progressComplete();
      this.logger.transaction(txId);

      return {
        success: true,
        signature: txId
      };
    } catch (error) {
      this.logger.progressFail();
      this.logger.error(`Failed to deposit liquidity: ${error}`);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Withdraw all liquidity from the pool
   */
  public async withdrawLiquidity(): Promise<TransactionResult> {
    try {
      this.logger.progress('Withdrawing all liquidity');

      const position = await this.getLiquidityPosition();
      if (!position) {
        this.logger.progressFail();
        throw new Error('No liquidity position found');
      }

      const poolInfo = await this.getPoolInfo();

      // Create remove liquidity instruction
      const { execute } = await this.raydium.liquidity.removeLiquidity({
        poolInfo: poolInfo as any, // Type assertion for SDK compatibility
        lpAmount: new BN(position.lpTokenBalance * Math.pow(10, 6)), // Convert to raw amount
        baseAmountMin: new BN(0), // Minimum base amount (NECK)
        quoteAmountMin: new BN(0), // Minimum quote amount (SOL)
        txVersion: TxVersion.V0
      });

      // Execute transaction
      const { txId } = await execute();

      this.logger.progressComplete();
      this.logger.transaction(txId);

      return {
        success: true,
        signature: txId
      };
    } catch (error) {
      this.logger.progressFail();
      this.logger.error(`Failed to withdraw liquidity: ${error}`);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Simulate transaction before execution
   */
  public async simulateTransaction(transaction: VersionedTransaction): Promise<boolean> {
    try {
      const result = await this.connection.simulateTransaction(transaction);

      if (result.value.err) {
        this.logger.error(`Transaction simulation failed: ${JSON.stringify(result.value.err)}`);
        return false;
      }

      this.logger.verbose(`Transaction simulation successful. Compute units: ${result.value.unitsConsumed}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to simulate transaction: ${error}`);
      return false;
    }
  }

  /**
   * Get network status
   */
  public async getNetworkStatus(): Promise<{ tps: number; blockHeight: number }> {
    try {
      const [recentBlockhash, slot] = await Promise.all([
        this.connection.getRecentBlockhash(),
        this.connection.getSlot()
      ]);

      // Simple TPS estimation (not accurate, but educational)
      const estimatedTps = 1000; // Placeholder

      return {
        tps: estimatedTps,
        blockHeight: slot
      };
    } catch (error) {
      this.logger.error(`Failed to fetch network status: ${error}`);
      return { tps: 0, blockHeight: 0 };
    }
  }

  /**
   * Retry logic for failed operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = DEFAULT_CONFIG.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (i < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000); // Exponential backoff
          this.logger.verbose(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}