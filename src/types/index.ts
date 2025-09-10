import { PublicKey } from '@solana/web3.js';

/**
 * Pool information structure
 */
export interface PoolInfo {
  poolId: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  lpToken: PublicKey;
  liquidity: {
    tokenA: number;
    tokenB: number;
    total: number;
  };
  price: {
    tokenA: number;
    tokenB: number;
  };
  fees24h?: number;
  volume24h?: number;
}

/**
 * User's liquidity position
 */
export interface LiquidityPosition {
  lpTokenBalance: number;
  valueUSD: number;
  tokenAAmount: number;
  tokenBAmount: number;
  share: number; // Percentage of pool ownership
  impermanentLoss?: number;
  feesEarned?: number;
}

/**
 * Transaction result structure
 */
export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  gasUsed?: number;
}

/**
 * Deposit operation parameters
 */
export interface DepositParams {
  amount: number; // Amount in SOL to deposit
  slippage?: number;
}

/**
 * Monitor data structure for real-time updates
 */
export interface MonitorData {
  timestamp: Date;
  poolPrice: number;
  priceChange24h: number;
  poolLiquidity: number;
  userPosition: LiquidityPosition;
  networkStats: {
    tps: number;
    blockHeight: number;
  };
}

/**
 * CLI command options
 */
export interface CliOptions {
  verbose?: boolean;
  dryRun?: boolean;
  slippage?: number;
}

/**
 * Logger levels
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * RPC connection status
 */
export interface RpcStatus {
  connected: boolean;
  latency: number;
  blockHeight: number;
  version?: string;
}

/**
 * Token information structure
 */
export interface TokenInfo {
  mint: PublicKey;
  decimals: number;
  symbol: string;
  name: string;
  isNative: boolean;
  supply?: number;
}

/**
 * Token balance information
 */
export interface TokenBalance {
  mint: PublicKey;
  owner: PublicKey;
  amount: number; // Raw amount
  decimals: number;
  uiAmount: number; // UI amount (accounting for decimals)
}

/**
 * Position tracking for educational features
 */
export interface PositionHistory {
  timestamp: Date;
  valueUSD: number;
  lpTokens: number;
  impermanentLoss: number;
  feesEarned: number;
  poolPrice: number;
}

/**
 * Risk metrics for educational display
 */
export interface RiskMetrics {
  impermanentLoss: {
    current: number;
    potential: number;
    explanation: string;
  };
  priceRisk: {
    volatility24h: number;
    priceChange24h: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  liquidityRisk: {
    poolDepth: number;
    utilization: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

/**
 * Enhanced pool statistics
 */
export interface PoolStatistics {
  totalValueLocked: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  apr: number;
  transactions24h: number;
  uniqueTraders24h: number;
  priceChangePercent: {
    '1h': number;
    '24h': number;
    '7d': number;
  };
}