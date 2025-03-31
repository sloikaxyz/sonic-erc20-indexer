import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20, Transfer, Approval } from "../../generated/ERC20/ERC20";
import {
  Token,
  Account,
  TokenBalance,
  Approval as ApprovalEntity,
  Portfolio,
  MarketData,
  Project,
  DenominatedValue,
} from "../../generated/schema";

// Constants
const CHAIN_ID = "146";
const CHAIN_NAME = "sonic";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Ensure token exists
function ensureToken(tokenAddress: Address): Token {
  let tokenId = tokenAddress.toHexString();
  let token = Token.load(tokenId);

  if (token == null) {
    token = new Token(tokenId);
    let contract = ERC20.bind(tokenAddress);
    
    // Fetch token metadata 
    let name = "Unknown Token";
    let symbol = "???";
    let decimals = 18;
    
    let nameResult = contract.try_name();
    if (!nameResult.reverted) {
      name = nameResult.value;
    }

    let symbolResult = contract.try_symbol();
    if (!symbolResult.reverted) {
      symbol = symbolResult.value;
    }

    let decimalsResult = contract.try_decimals();
    if (!decimalsResult.reverted) {
      decimals = decimalsResult.value;
    }

    let totalSupply = BigInt.fromI32(0);
    let totalSupplyResult = contract.try_totalSupply();
    if (!totalSupplyResult.reverted) {
      totalSupply = totalSupplyResult.value;
    }

    // Create project
    let projectId = "project-" + tokenId;
    let project = new Project(projectId);
    project.name = name;
    project.logoUrl = "";
    project.safetyLevel = "VERIFIED";
    project.isSpam = false;
    project.save();

    // Create market data
    let marketDataId = "market-" + tokenId;
    let marketData = new MarketData(marketDataId);
    marketData.token = tokenId;
    marketData.totalSupply = totalSupply;
    marketData.circulatingSupply = totalSupply;
    marketData.volume24h = BigInt.fromI32(0);
    marketData.updatedAt = "0"; 
    marketData.save();

    // Setup token
    token.address = tokenId;
    token.chain = CHAIN_ID;
    token.symbol = symbol;
    token.name = name;
    token.decimals = decimals;
    token.standard = "ERC20";
    token.project = projectId;
    token.marketData = marketDataId;
    token.transactionCount = 0;
    token.transferVolume = BigInt.fromI32(0);
    token.holderCount = 0;
    token.updatedAt = "0";
    token.save();
  }

  return token as Token;
}

// Ensure account exists
function ensureAccount(accountAddress: Address): Account {
  let accountId = accountAddress.toHexString();
  let account = Account.load(accountId);

  if (account == null) {
    account = new Account(accountId);
    account.save();
  }

  return account as Account;
}

// Ensure portfolio exists
function ensurePortfolio(ownerAddress: Address): Portfolio {
  let portfolioId = ownerAddress.toHexString();
  let portfolio = Portfolio.load(portfolioId);

  if (portfolio == null) {
    ensureAccount(ownerAddress);
    portfolio = new Portfolio(portfolioId);
    portfolio.ownerAddress = portfolioId;
    portfolio.chain = CHAIN_NAME;
    portfolio.account = portfolioId;
    portfolio.save();
  }

  return portfolio as Portfolio;
}

// Handle token transfers
export function handleTransfer(event: Transfer): void {
  let tokenAddress = event.address;
  let token = ensureToken(tokenAddress);
  
  // Update token statistics
  token.transactionCount += 1;
  token.transferVolume = token.transferVolume.plus(event.params.value);
  token.updatedAt = event.block.timestamp.toString();
  token.save();
  
  // Update sender balance if not minting
  if (event.params.from.toHexString() != ZERO_ADDRESS) {
    ensureAccount(event.params.from);
    ensurePortfolio(event.params.from);
    
    let balanceId = event.params.from.toHexString() + "-" + tokenAddress.toHexString();
    let balance = TokenBalance.load(balanceId);
    
    if (balance == null) {
      balance = new TokenBalance(balanceId);
      balance.owner = event.params.from.toHexString();
      balance.token = tokenAddress.toHexString();
      balance.quantity = BigInt.fromI32(0).minus(event.params.value);
    } else {
      balance.quantity = balance.quantity.minus(event.params.value);
    }
    
    balance.save();
    
    // Update holder count if balance is zero
    if (balance.quantity.equals(BigInt.fromI32(0))) {
      token.holderCount = token.holderCount > 0 ? token.holderCount - 1 : 0;
      token.save();
    }
  }
  
  // Update receiver balance
  ensureAccount(event.params.to);
  ensurePortfolio(event.params.to);
  
  let balanceId = event.params.to.toHexString() + "-" + tokenAddress.toHexString();
  let balance = TokenBalance.load(balanceId);
  
  let isNewHolder = false;
  
  if (balance == null) {
    balance = new TokenBalance(balanceId);
    balance.owner = event.params.to.toHexString();
    balance.token = tokenAddress.toHexString();
    balance.quantity = event.params.value;
    isNewHolder = true;
  } else {
    let wasZero = balance.quantity.equals(BigInt.fromI32(0));
    balance.quantity = balance.quantity.plus(event.params.value);
    isNewHolder = wasZero && !balance.quantity.equals(BigInt.fromI32(0));
  }
  
  balance.save();
  
  // Update holder count if new holder
  if (isNewHolder) {
    token.holderCount += 1;
    token.save();
  }
}

// Handle token approvals
export function handleApproval(event: Approval): void {
  let tokenAddress = event.address;
  ensureToken(tokenAddress);
  ensureAccount(event.params.owner);
  ensureAccount(event.params.spender);
  
  let approvalId = event.params.owner.toHexString() + "-" + 
                  event.params.spender.toHexString() + "-" + 
                  tokenAddress.toHexString();
  
  let approval = new ApprovalEntity(approvalId);
  approval.owner = event.params.owner.toHexString();
  approval.spender = event.params.spender.toHexString();
  approval.token = tokenAddress.toHexString();
  approval.amount = event.params.value;
  approval.save();
}