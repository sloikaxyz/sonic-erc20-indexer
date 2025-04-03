import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Approval, ERC20, Transfer } from "../../generated/ERC20/ERC20";
import {
  Account,
  Approval as ApprovalEntity,
  MarketData,
  Portfolio,
  Project,
  Token,
  TokenBalance,
} from "../../generated/schema";

// Constants
const CHAIN_ID = Bytes.fromI32(146);
const CHAIN_NAME = "sonic";
const ZERO_ADDRESS = Address.fromHexString(
  "0x0000000000000000000000000000000000000000"
);

// Ensure token exists
function ensureToken(tokenAddress: Address): Token {
  let tokenId = tokenAddress;
  let token = Token.load(tokenId.toHexString());

  if (token == null) {
    token = new Token(tokenId.toHexString());
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
    let projectId = Bytes.fromUTF8("project-").concat(tokenId);
    let project = new Project(projectId.toHexString());
    project.name = name;
    project.logoUrl = "";
    project.safetyLevel = "VERIFIED";
    project.isSpam = false;
    project.save();

    // Create market data
    let marketDataId = Bytes.fromUTF8("market-").concat(tokenId);
    let marketData = new MarketData(marketDataId.toHexString());
    marketData.token = tokenId.toHexString();
    marketData.totalSupply = totalSupply;
    marketData.circulatingSupply = totalSupply;
    marketData.volume24h = BigInt.fromI32(0);
    marketData.updatedAt = BigInt.fromI32(0).toString();
    marketData.save();

    // Setup token
    token.address = tokenId.toHexString();
    token.chain = CHAIN_ID.toHexString();
    token.symbol = symbol;
    token.name = name;
    token.decimals = decimals;
    token.standard = "ERC20";
    token.project = projectId.toHexString();
    token.marketData = marketDataId.toHexString();
    token.transactionCount = 0;
    token.transferVolume = BigInt.fromI32(0);
    token.holderCount = 0;
    token.updatedAt = BigInt.fromI32(0).toString();
    token.save();

    log.info("Created new token: {} ({})", [tokenId.toHexString(), name]);
  }

  return token as Token;
}

// Ensure account exists
function ensureAccount(accountAddress: Address): Account {
  let accountId = accountAddress;
  let account = Account.load(accountId.toHexString());

  if (account == null) {
    account = new Account(accountId.toHexString());
    account.save();
    log.info("Created new account: {}", [accountId.toHexString()]);
  }

  return account as Account;
}

// Ensure portfolio exists
function ensurePortfolio(ownerAddress: Address): Portfolio {
  let portfolioId = ownerAddress;
  let portfolio = Portfolio.load(portfolioId.toHexString());

  if (portfolio == null) {
    ensureAccount(ownerAddress);
    portfolio = new Portfolio(portfolioId.toHexString());
    portfolio.ownerAddress = portfolioId.toHexString();
    portfolio.chain = CHAIN_NAME;
    portfolio.account = portfolioId.toHexString();
    portfolio.save();
    log.info("Created new portfolio: {}", [portfolioId.toHexString()]);
  }

  return portfolio as Portfolio;
}

// Handle token transfers
export function handleTransfer(event: Transfer): void {
  log.info("Processing transfer event: {}", [
    event.transaction.hash.toHexString(),
  ]);

  let tokenAddress = event.address;
  let token = ensureToken(tokenAddress);

  // Update token statistics
  token.transactionCount += 1;
  token.transferVolume = token.transferVolume.plus(event.params.value);
  token.updatedAt = event.block.timestamp.toString();
  token.save();

  // Update sender balance if not minting
  if (!event.params.from.equals(ZERO_ADDRESS)) {
    ensureAccount(event.params.from);
    ensurePortfolio(event.params.from);

    let balanceId = event.params.from.concat(tokenAddress);
    let balance = TokenBalance.load(balanceId.toHexString());

    if (balance == null) {
      balance = new TokenBalance(balanceId.toHexString());
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

  let balanceId = event.params.to.concat(tokenAddress);
  let balance = TokenBalance.load(balanceId.toHexString());

  let isNewHolder = false;

  if (balance == null) {
    balance = new TokenBalance(balanceId.toHexString());
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

  log.info("Processed transfer: {} from {} to {} amount {}", [
    tokenAddress.toHexString(),
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString(),
  ]);
}

// Handle token approvals
export function handleApproval(event: Approval): void {
  let tokenAddress = event.address;
  ensureToken(tokenAddress);
  ensureAccount(event.params.owner);
  ensureAccount(event.params.spender);

  let approvalId = event.params.owner
    .concat(event.params.spender)
    .concat(tokenAddress);

  let approval = new ApprovalEntity(approvalId.toHexString());
  approval.owner = event.params.owner.toHexString();
  approval.spender = event.params.spender.toHexString();
  approval.token = tokenAddress.toHexString();
  approval.amount = event.params.value;
  approval.save();

  log.info("Processed approval: {} owner {} spender {} amount {}", [
    tokenAddress.toHexString(),
    event.params.owner.toHexString(),
    event.params.spender.toHexString(),
    event.params.value.toString(),
  ]);
}
