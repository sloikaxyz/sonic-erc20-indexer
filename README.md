# Sonic ERC20 Subgraph

This subgraph indexes ERC20 token transfers and approvals on the Sonic blockchain, tracking:
- Token metadata
- Account balances
- Token approvals
- Market data
- Portfolio tracking
- Token popularity metrics

## Setup and Development

### Prerequisites

- Node.js (v16 or later)
- PNPM or NPM
- Graph CLI (`pnpm install -g @graphprotocol/graph-cli`)

### Installation

```bash
# Install dependencies
pnpm install
```

### Local Development

```bash
# Generate AssemblyScript types from subgraph schema and ABIs
graph codegen

# Build the subgraph
graph build
```

## Deployment Options

### Option 1: Self-Hosted Graph Node

For custom chains like Sonic, running your own Graph Node is often the most direct approach:

1. Set up a Graph Node connected to a Sonic RPC:
   ```yaml
   graph-node:
     environment:
       - ethereum=mainnet:https://eth-mainnet.alchemyapi.io/v2/your-api-key
       - sonic:146:https://rpc.soniclabs.com
   ```

2. Deploy to your Graph Node:
   ```bash
   graph create --node http://localhost:8020/ sonic-erc20-subgraph
   graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 sonic-erc20-subgraph
   ```

### Option 2: The Graph Hosted Service

While The Graph's hosted service doesn't directly support Sonic yet, you can request support:

1. Submit a request to The Graph team to add Sonic chain support
2. Once supported, deploy using:
   ```bash
   graph auth --product hosted-service <YOUR_DEPLOY_KEY>
   graph deploy --product hosted-service <YOUR_GITHUB_USER>/<SUBGRAPH_NAME>
   ```

### Option 3: Alchemy Subgraphs (Network Request Required)

As of now, Alchemy Subgraphs doesn't directly support the Sonic chain, but you can:

1. Contact Alchemy support to request adding Sonic chain support
2. Once supported, deploy using:
   ```bash
   graph deploy sonic-erc20-subgraph \
     --version-label v0.1.0 \
     --node https://subgraphs.alchemy.com/api/subgraphs/deploy \
     --deploy-key <YOUR_DEPLOY_KEY> \
     --ipfs https://ipfs.satsuma.xyz
   ```

## Schema

The schema includes the following entities:
- `Token`: ERC20 token with metadata, popularity metrics
- `Account`: User/wallet addresses
- `TokenBalance`: Links tokens to accounts with balance
- `Approval`: Token spending permissions
- `Portfolio`: User's token collection per chain
- `MarketData`: Price and market information
- `Project`: Additional metadata for display

## Queries

Example GraphQL queries:

```graphql
# Get top tokens by holder count
{
  tokens(first: 10, orderBy: holderCount, orderDirection: desc) {
    id
    name
    symbol
    holderCount
    transactionCount
    transferVolume
  }
}

# Get token balances for a specific account
{
  account(id: "0x...") {
    tokenBalances {
      token {
        name
        symbol
      }
      quantity
    }
  }
}
```

## Customization

- Adjust start block in `subgraph.yaml` for different indexing starting points
- Modify event handlers in `src/mappings/erc20.ts` to capture additional data

## Notes for Sonic Chain

This subgraph is specifically configured for the Sonic blockchain (chain ID 146). The RPC endpoints in the mapping code are configured to access the Sonic network.