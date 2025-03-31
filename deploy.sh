#!/bin/bash
# Deploy to Alchemy Subgraphs (correct endpoint)
graph deploy sonic-erc20-subgraph \
  --version-label v0.1.0 \
  --node https://subgraphs.alchemy.com/api/subgraphs/deploy \
  --deploy-key g5gM7XrReZJ3F \
  --ipfs https://ipfs.satsuma.xyz