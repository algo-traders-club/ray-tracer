import { PublicKey } from '@solana/web3.js';

/**
 * Hardcoded configuration for the NECK-SOL Raydium pool
 * This is the main pool targeted for educational liquidity provision
 */
export const POOL_CONFIG = {
  POOL_ID: '5aEG1Vv4dJE5MiFqLTXrvVJPVD5g2d2FgK7vPco2KHfJ',
  TOKEN_A: 'BByRYGw5yrSQpPXFYoy7euzwtxwkbKz8JpQwz9sgpump', // NECK
  TOKEN_B: 'So11111111111111111111111111111111111111112',    // WSOL
  POOL_NAME: 'NECK-SOL',
  PROGRAM_ID: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' // Raydium AMM Program
} as const;

/**
 * Token mint addresses as PublicKey objects for SDK usage
 */
export const TOKEN_MINTS = {
  NECK: new PublicKey(POOL_CONFIG.TOKEN_A),
  WSOL: new PublicKey(POOL_CONFIG.TOKEN_B),
  POOL: new PublicKey(POOL_CONFIG.POOL_ID)
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  SLIPPAGE_TOLERANCE: 0.5, // 0.5%
  PRIORITY_FEE_MICRO_LAMPORTS: 1000,
  MONITOR_INTERVAL_MS: 5000, // 5 seconds
  MAX_RETRIES: 3,
  RPC_TIMEOUT_MS: 30000
} as const;

/**
 * Console colors for logging
 */
export const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m'
} as const;

/**
 * Log level emojis
 */
export const LOG_EMOJIS = {
  INFO: '📊',
  SUCCESS: '✅',
  WARNING: '⚠️',
  ERROR: '❌',
  POOL: '🏊',
  MONEY: '💰',
  CHART: '📈',
  LIGHTNING: '⚡',
  SEARCH: '🔍',
  DROPLET: '💧',
  ROBOT: '🤖'
} as const;

/**
 * Raydium SDK configuration
 */
export const RAYDIUM_CONFIG = {
  COMMITMENT: 'confirmed' as const,
  ENDPOINT_TYPE: 'mainnet-beta' as const
};