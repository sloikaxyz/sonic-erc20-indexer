#!/bin/bash
# Deploy to Alchemy Subgraphs using a new subgraph name specifically for Sonic
graph deploy sonic-chain-erc20-indexer \
  --version-label v0.1.2 \
  --node https://subgraphs.alchemy.com/api/subgraphs/deploy \
  --deploy-key g5gM7XrReZJ3F \
  --ipfs https://ipfs.satsuma.xyz