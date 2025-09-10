# 🚀 Ray Tracer - Raydium Liquidity Bot Educational Template

**Ray Tracer** is an educational TypeScript CLI application that demonstrates automated liquidity provision on Solana's Raydium DEX. This template focuses specifically on the **NECK-SOL** pool and serves as a comprehensive learning resource for students interested in DeFi development and automated market making.

> ⚠️ **Educational Purpose Only**: This is a learning template. Always test with small amounts and understand the risks of liquidity provision before using real funds.

## 🎯 What You'll Learn

- **Solana Development**: Web3.js integration and transaction handling
- **DeFi Mechanics**: Automated Market Makers (AMMs) and liquidity provision
- **Risk Management**: Impermanent loss, slippage, and position monitoring
- **TypeScript Best Practices**: Modern async/await patterns and error handling
- **CLI Development**: Building production-quality command-line tools

## ✨ Features

### 🏊 Core Liquidity Operations

- **Deposit**: Add equal-value SOL/NECK liquidity to the pool
- **Withdraw**: Remove all liquidity positions at once
- **Status**: Check current position value and pool statistics
- **Monitor**: Real-time position tracking with live updates

### 🛡️ Safety & Security Features

- Private key management with environment variables
- Transaction simulation before execution
- Configurable slippage protection
- Comprehensive error handling and retry logic
- Dry-run mode for testing without real transactions

### 📊 Educational Monitoring

- Real-time pool price tracking
- Impermanent loss calculations (educational feature)
- Fee earnings estimation
- Network statistics and performance metrics

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **Bun** package manager (recommended) or npm
- **Solana Wallet** with some SOL for testing
- **Helius RPC** account (free tier available)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url> ray-tracer
cd ray-tracer

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your credentials:

```env
# Your wallet's private key (base58 encoded)
PRIVATE_KEY=your_wallet_private_key_here

# Helius RPC endpoint (get free API key from helius.dev)
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_api_key

# Optional: Adjust trading parameters
SLIPPAGE_TOLERANCE=0.5
PRIORITY_FEE_MICRO_LAMPORTS=1000
```

### 3. Build and Test

```bash
# Build the TypeScript code
bun run build

# Test connection (dry run)
bun start status --dry-run
```

## 📋 Commands Reference

### Check Position Status

```bash
bun start status
```

**Example Output:**

```
🤖 Ray Tracer - Position Status
📊 Wallet: 7B4n...Kx2p
💰 SOL Balance: 1.2345 SOL
──────────────────────────────────────────────────
🏊 Pool: NECK-SOL
📈 NECK Price: $0.001234 USD
💧 Total Liquidity: $12,345 USD
⚡ 24h Volume: $5,678 USD
──────────────────────────────────────────────────
💰 LP Tokens: 1,234.567890 LP
📈 Position Value: $45.67 USD
📊 Pool Share: 0.0123%
⚡ NECK Amount: 37,000.123456 NECK
⚡ SOL Amount: 0.0456 SOL
```

### Deposit Liquidity

```bash
# Deposit 0.1 SOL worth of liquidity
bun start deposit 0.1

# Deposit with custom slippage
bun start deposit 0.5 --slippage 1.0

# Dry run to test without executing
bun start deposit 0.1 --dry-run
```

### Withdraw All Liquidity

```bash
# Withdraw entire position
bun start withdraw

# Preview withdrawal without executing
bun start withdraw --dry-run
```

### Real-time Monitoring

```bash
# Monitor position with live updates
bun start monitor

# Monitor with verbose logging
bun start monitor --verbose
```

**Example Monitor Output:**

```
🤖 Ray Tracer - Position Monitor
🔍 Starting position monitor... (Press Ctrl+C to stop)

🔍 [10:30:15] Position Monitor - Update #1
📈 NECK Price: $0.001234 (+2.3%)
💧 Pool Liquidity: $12,345 USD
📊 Network: Block 245,678,901 | TPS ~1000
💰 Position Value: $45.67 USD
⚡ Pool Share: 0.0123%
```

## 🔧 Configuration Options

### Global CLI Options

```bash
-v, --verbose        Enable verbose logging
-d, --dry-run       Simulate without executing transactions
-s, --slippage <n>  Set slippage tolerance (default: 0.5%)
```

### Environment Variables

| Variable                      | Required | Default | Description                             |
| ----------------------------- | -------- | ------- | --------------------------------------- |
| `PRIVATE_KEY`                 | ✅       | -       | Base58 encoded wallet private key       |
| `HELIUS_RPC_URL`              | ✅       | -       | Helius RPC endpoint with API key        |
| `SLIPPAGE_TOLERANCE`          | ❌       | 0.5     | Slippage tolerance percentage (0.1-5.0) |
| `PRIORITY_FEE_MICRO_LAMPORTS` | ❌       | 1000    | Transaction priority fee                |

## 🏗️ Project Structure

```
ray-tracer/
├── src/
│   ├── config/
│   │   ├── constants.ts      # Pool configuration and constants
│   │   └── environment.ts    # Environment validation
│   ├── services/
│   │   ├── raydium.service.ts   # Raydium SDK integration
│   │   ├── wallet.service.ts    # Wallet management
│   │   └── logger.service.ts    # Colored console output
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── utils/
│   │   └── helpers.ts        # Utility functions
│   └── index.ts              # Main CLI application
├── .env.example              # Environment template
├── package.json              # Dependencies and scripts
└── README.md                 # This documentation
```

## 🧠 Understanding Liquidity Provision

### What is Automated Market Making?

When you provide liquidity to a Raydium pool, you're essentially becoming a **market maker**. Your funds are used to facilitate trades between other users, and you earn fees in return.

**Key Concepts:**

1. **Liquidity Pools**: Smart contracts holding two tokens (NECK and SOL)
2. **LP Tokens**: Represent your share of the pool
3. **Trading Fees**: Earned from each swap transaction
4. **Impermanent Loss**: Potential loss compared to just holding tokens

### Risk Factors

⚠️ **Important Risks to Understand:**

- **Impermanent Loss**: If token prices diverge, you may end up with less value than holding
- **Smart Contract Risk**: Bugs in Raydium contracts could affect funds
- **Market Risk**: Crypto prices can be extremely volatile
- **Slippage**: Large trades may move prices unfavorably

### Best Practices

✅ **Recommended Practices:**

- Start with small amounts to learn
- Monitor positions regularly
- Understand the tokens you're providing liquidity for
- Keep some SOL for transaction fees
- Use appropriate slippage settings (0.5-2% typically)

## 🛠️ Development Guide

### Adding New Features

The codebase is designed to be easily extensible:

```typescript
// Example: Add a new command
program
  .command('my-feature')
  .description('My custom feature')
  .action(async (options) => {
    // Implementation here
  });
```

### Customizing for Other Pools

To target different Raydium pools, modify `src/config/constants.ts`:

```typescript
export const POOL_CONFIG = {
  POOL_ID: 'your_pool_id_here',
  TOKEN_A: 'token_a_mint_address',
  TOKEN_B: 'token_b_mint_address',
  POOL_NAME: 'TOKEN-TOKEN',
} as const;
```

### Testing

```bash
# Build and test
bun run build
bun start status --dry-run --verbose

# Test with small amounts first
bun start deposit 0.001 --dry-run
```

## 🚨 Security Warnings

### 🔐 Private Key Security

**NEVER:**

- Commit private keys to version control
- Share private keys in chat/email
- Use production keys for testing
- Store keys in plain text files

**ALWAYS:**

- Use environment variables for keys
- Generate separate keys for testing
- Keep production keys in secure hardware wallets
- Review code before running with real funds

### 🛡️ Safe Testing

1. **Create a Test Wallet**: Generate a separate keypair for testing
2. **Use Small Amounts**: Start with dust amounts (0.001-0.01 SOL)
3. **Test on Devnet**: Consider setting up devnet testing first
4. **Verify Pool IDs**: Double-check you're using the correct pool

## 🔧 Troubleshooting

### Common Issues

**Environment Setup**

```bash
# Error: Missing environment variable
✗ Check .env file exists and contains all required variables
✓ Copy .env.example to .env and fill in values
```

**RPC Connection**

```bash
# Error: Failed to connect to Solana RPC
✗ Check Helius API key is correct
✗ Check internet connection
✓ Try different RPC endpoint
```

**Insufficient Balance**

```bash
# Error: Insufficient SOL balance
✓ Check wallet has enough SOL for deposit + fees
✓ Keep ~0.01 SOL for transaction fees
```

**Transaction Failures**

```bash
# Error: Transaction failed due to slippage
✓ Increase slippage tolerance (--slippage 1.0)
✓ Try during lower network activity
✓ Increase priority fee in .env
```

### Debug Mode

Enable verbose logging for detailed information:

```bash
bun start status --verbose
```

## 📚 Educational Resources

### Learn More About DeFi

- [Raydium Documentation](https://docs.raydium.io/)
- [Solana Web3.js Guide](https://docs.solana.com/developing/clients/javascript-api)
- [Understanding Impermanent Loss](https://academy.binance.com/en/articles/impermanent-loss-explained)
- [AMM Basics](https://academy.binance.com/en/articles/what-are-automated-market-makers-amms)

### Solana Development

- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Framework](https://anchor-lang.com/)
- [Metaplex Documentation](https://docs.metaplex.com/)

## 🤝 Contributing

This is an educational template - contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request with clear description

## 📄 License

MIT License - see LICENSE file for details.

---

## ⚡ Quick Commands Cheat Sheet

```bash
# Setup
bun install && cp .env.example .env

# Check status
bun start status

# Deposit 0.1 SOL worth
bun start deposit 0.1

# Monitor real-time
bun start monitor

# Withdraw everything
bun start withdraw

# Test without executing
bun start status --dry-run --verbose
```

**Happy Learning! 🚀**

> Remember: This is educational software. Always understand the risks and start with small amounts when learning DeFi development.

---

© Copyright 2025 Algo Traders Club LLC - MIT License
