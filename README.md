# Sonic ERC-20 Indexer

A blockchain indexer built with [Envio](https://envio.dev) that tracks ERC-20 token transfers and approvals on the Sonic blockchain.

## Overview

This project indexes ERC-20 token events (Transfers and Approvals) on the Sonic blockchain, starting from block 10861674. It maintains a database of account balances and approval records, which can be queried through a GraphQL API.

## Features

- Tracks ERC-20 token transfers between accounts
- Records token approvals (allowances)
- Maintains up-to-date account balances
- Supports wildcard contract tracking (indexes events from any ERC-20 token)
- Provides a GraphQL API for querying indexed data
- Supports unordered multichain indexing

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [pnpm](https://pnpm.io/) package manager
- An [Envio API token](https://envio.dev/app/api-tokens)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/caffeinum/sonic-erc20-indexer.git
   cd sonic-erc20-indexer
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Add your Envio API token to the `.env` file:
   ```
   ENVIO_API_TOKEN="your-api-token-here"
   ```

## Configuration

The indexer is configured in `config.yaml`:

- **Network**: Sonic Mainnet (Chain ID: 146)
- **Starting Block**: 10861674
- **Tracked Events**:
  - `Transfer(address indexed from, address indexed to, uint256 value)`
  - `Approval(address indexed owner, address indexed spender, uint256 value)`

You can modify the configuration to track specific token contracts by uncommenting and setting the `address` field in the config file.

## Data Schema

The project uses the following GraphQL schema:

### Account
- `id`: The account address (primary key)
- `balance`: Current token balance
- `approvals`: List of approvals granted by this account

### Approval
- `id`: Composite key of owner and spender addresses
- `amount`: Approved token amount
- `owner`: Account that granted the approval
- `spender`: Account that received the approval

## Development

### Generate Code

Before running the indexer, generate the necessary code:

```bash
pnpm codegen
```

### Run in Development Mode

Start the indexer in development mode:

```bash
pnpm dev
```

### Build

Compile the TypeScript code:

```bash
pnpm build
```

### Run Tests

Execute the test suite:

```bash
pnpm test
```

## Event Handlers

The indexer processes two types of events:

### Transfer Events

When a token transfer occurs:
1. Updates the sender's balance (subtracts the transferred amount)
2. Updates the receiver's balance (adds the transferred amount)
3. Creates new account records if needed

### Approval Events

When a token approval is granted:
1. Records the approval with owner, spender, and amount
2. Creates new account records if needed

## Advanced Usage

### Filtering Events

You can filter events by uncommenting and modifying the `eventFilters` section in the event handlers. For example, to track only mint operations (transfers from the zero address):

```typescript
eventFilters: { from: "0x0000000000000000000000000000000000000000" }
```

### Multichain Indexing

The indexer supports unordered multichain mode, allowing you to index events from multiple chains in real-time. See the [Envio documentation](https://docs.envio.dev/docs/HyperIndex/multichain-indexing#unordered-multichain-mode) for more details.

## Production Deployment

To run the indexer in production:

```bash
pnpm start
```

## Resources

- [Envio Documentation](https://docs.envio.dev)
- [Sonic Blockchain Explorer](https://explorer.sonic.org/)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

## License

This project is open source and available under the [MIT License](LICENSE).
