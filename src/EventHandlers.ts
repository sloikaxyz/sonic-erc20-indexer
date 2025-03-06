import { Approval, ERC20, Project } from "generated";
import {
  createPublicClient,
  fallback,
  getContract,
  http,
  parseAbi,
} from "viem";

// Default chain is Sonic Mainnet (assuming it's a fork of Ethereum with chain ID 146)
const CHAIN_ID = "146";
const CHAIN_NAME = "sonic";

// Create a custom chain configuration for Sonic
const sonicChain = {
  id: 146,
  name: "Sonic",
  network: "sonic",
  nativeCurrency: {
    decimals: 18,
    name: "Sonic",
    symbol: "SONIC",
  },
  rpcUrls: {
    default: {
      http: [
        "https://rpc.soniclabs.com",
        "https://rpc.ankr.com/sonic_mainnet",
        "https://sonic-rpc.publicnode.com",
        "https://sonic.drpc.org",
      ],
      webSocket: [
        "wss://sonic.callstaticrpc.com",
        "wss://sonic-rpc.publicnode.com",
        "wss://sonic.drpc.org",
        "wss://rpc.ankr.com/sonic_mainnet/ws",
      ],
    },
    public: {
      http: [
        "https://rpc.soniclabs.com",
        "https://rpc.ankr.com/sonic_mainnet",
        "https://sonic-rpc.publicnode.com",
        "https://sonic.drpc.org",
      ],
      webSocket: [
        "wss://sonic.callstaticrpc.com",
        "wss://sonic-rpc.publicnode.com",
        "wss://sonic.drpc.org",
        "wss://rpc.ankr.com/sonic_mainnet/ws",
      ],
    },
  },
};

// Create a public client for Sonic chain with fallback RPC support
const publicClient = createPublicClient({
  chain: sonicChain,
  transport: fallback(
    [
      http("https://rpc.soniclabs.com"),
      http("https://rpc.ankr.com/sonic_mainnet"),
      http("https://sonic-rpc.publicnode.com"),
      http("https://sonic.drpc.org"),
    ],
    {
      rank: true, // Enable automatic ranking based on latency and stability
    }
  ),
});

// ERC20 ABI for fetching token metadata
const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

// Function to ensure token exists and has metadata
async function ensureToken(tokenAddress: string, context: any) {
  let token = await context.Token.get(tokenAddress);

  if (token === undefined) {
    try {
      // Create a contract instance using viem
      const contract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      });

      // Fetch token metadata - using proper typings for viem
      let name = "Unknown Token";
      let symbol = "???";
      let decimals = 18;
      let totalSupply = 0n;

      try {
        name = await contract.read.name();
      } catch (e) {
        console.error(`Error fetching token name for ${tokenAddress}:`, e);
      }

      try {
        symbol = await contract.read.symbol();
      } catch (e) {
        console.error(`Error fetching token symbol for ${tokenAddress}:`, e);
      }

      try {
        decimals = Number(await contract.read.decimals());
      } catch (e) {
        console.error(`Error fetching token decimals for ${tokenAddress}:`, e);
      }

      try {
        totalSupply = await contract.read.totalSupply();
      } catch (e) {
        console.error(
          `Error fetching token totalSupply for ${tokenAddress}:`,
          e
        );
      }

      // Create project with default values
      const projectId = `project-${tokenAddress}`;
      const project: Project = {
        id: projectId,
        name: name,
        logoUrl: "",
        safetyLevel: "VERIFIED", // Default safety level
        isSpam: false,
      };
      await context.Project.set(project);

      // Create market data entity
      const marketDataId = `market-${tokenAddress}`;
      await context.MarketData.set({
        id: marketDataId,
        token_id: tokenAddress,
        price_id: null,
        fullyDilutedValuation_id: null,
        marketCap_id: null,
        totalSupply: totalSupply,
        circulatingSupply: totalSupply, // Default to total supply
        volume24h: 0n,
        updatedAt: new Date().toISOString(),
      });

      // Create token entity with new popularity metrics
      const currentTimestamp = new Date().toISOString();
      token = {
        id: tokenAddress,
        address: tokenAddress,
        chain: CHAIN_ID,
        symbol: symbol,
        name: name,
        decimals: decimals,
        standard: "ERC20",
        project_id: projectId,
        marketData_id: marketDataId,
        transactionCount: 0,
        transferVolume: 0n,
        holderCount: 0,
        updatedAt: currentTimestamp,
      };
      await context.Token.set(token);
    } catch (error) {
      console.error(
        `Error fetching token metadata for ${tokenAddress}:`,
        error
      );

      // Create token with default values if metadata fetch fails
      const currentTimestamp = new Date().toISOString();

      // Create market data entity
      const marketDataId = `market-${tokenAddress}`;
      await context.MarketData.set({
        id: marketDataId,
        token_id: tokenAddress,
        price_id: null,
        fullyDilutedValuation_id: null,
        marketCap_id: null,
        totalSupply: 0n,
        circulatingSupply: 0n,
        volume24h: 0n,
        updatedAt: currentTimestamp,
      });

      token = {
        id: tokenAddress,
        address: tokenAddress,
        chain: CHAIN_ID,
        symbol: "???",
        name: "Unknown Token",
        decimals: 18,
        standard: "ERC20",
        project_id: null,
        marketData_id: marketDataId,
        transactionCount: 0,
        transferVolume: 0n,
        holderCount: 0,
        updatedAt: currentTimestamp,
      };
      await context.Token.set(token);
    }
  }

  return token;
}

// Function to ensure account exists
async function ensureAccount(accountAddress: string, context: any) {
  let account = await context.Account.get(accountAddress);

  if (account === undefined) {
    account = {
      id: accountAddress,
    };
    await context.Account.set(account);
  }

  return account;
}

// Function to ensure portfolio exists
async function ensurePortfolio(ownerAddress: string, context: any) {
  let portfolio = await context.Portfolio.get(ownerAddress);

  if (portfolio === undefined) {
    // Ensure account exists first
    await ensureAccount(ownerAddress, context);

    portfolio = {
      id: ownerAddress,
      ownerAddress: ownerAddress,
      chain: CHAIN_NAME,
      tokensTotalDenominatedValue_id: null,
      account_id: ownerAddress,
    };
    await context.Portfolio.set(portfolio);
  }

  return portfolio;
}

// Function to update token balance
async function updateTokenBalance(
  ownerAddress: string,
  tokenAddress: string,
  amount: bigint,
  context: any
) {
  // Ensure token exists
  await ensureToken(tokenAddress, context);

  // Ensure account exists
  await ensureAccount(ownerAddress, context);

  // Ensure portfolio exists
  await ensurePortfolio(ownerAddress, context);

  // Get existing token balance or create new one
  const balanceId = `${ownerAddress}-${tokenAddress}`;
  let tokenBalance = await context.TokenBalance.get(balanceId);

  const isNewHolder = tokenBalance === undefined && amount > 0n;
  const isRemovedHolder =
    tokenBalance !== undefined && tokenBalance.quantity > 0n && amount === 0n;

  if (tokenBalance === undefined) {
    tokenBalance = {
      id: balanceId,
      quantity: amount,
      owner_id: ownerAddress,
      token_id: tokenAddress,
      denominatedValue_id: null,
    };
  } else {
    tokenBalance.quantity = amount;
  }

  await context.TokenBalance.set(tokenBalance);

  // Update holder count if necessary
  if (isNewHolder || isRemovedHolder) {
    const token = await context.Token.get(tokenAddress);
    if (token) {
      token.holderCount = isNewHolder
        ? token.holderCount + 1
        : Math.max(0, token.holderCount - 1);
      token.updatedAt = new Date().toISOString();
      await context.Token.set(token);
    }
  }
}

// Function to update token popularity metrics
async function updateTokenPopularity(
  tokenAddress: string,
  transferAmount: bigint,
  context: any
) {
  const token = await context.Token.get(tokenAddress);

  if (token) {
    // Increment transaction count
    token.transactionCount += 1;

    // Add to transfer volume
    token.transferVolume = token.transferVolume + transferAmount;

    // Update timestamp
    token.updatedAt = new Date().toISOString();

    await context.Token.set(token);

    // Update market data volume - if token has marketData
    if (token.marketData_id) {
      const marketData = await context.MarketData.get(token.marketData_id);
      if (marketData) {
        marketData.volume24h += transferAmount;
        marketData.updatedAt = new Date().toISOString();
        await context.MarketData.set(marketData);
      }
    }
  }
}

ERC20.Approval.handler(
  async ({ event, context }) => {
    // Get contract address from the event source
    const tokenAddress = event.srcAddress.toString();

    // Ensure token exists
    await ensureToken(tokenAddress, context);

    // Ensure owner account exists
    await ensureAccount(event.params.owner.toString(), context);

    // Ensure spender account exists
    await ensureAccount(event.params.spender.toString(), context);

    // Create approval ID
    let approvalId = `${event.params.owner.toString()}-${event.params.spender.toString()}-${tokenAddress}`;

    // Create approval object
    let approvalObject: Approval = {
      id: approvalId,
      amount: event.params.value,
      owner_id: event.params.owner.toString(),
      spender_id: event.params.spender.toString(),
      token_id: tokenAddress,
    };

    // Set approval
    await context.Approval.set(approvalObject);
  },
  {
    wildcard: true,
  }
);

ERC20.Transfer.handler(
  async ({ event, context }) => {
    // Get contract address from the event source
    const tokenAddress = event.srcAddress.toString();

    // Ensure token exists
    await ensureToken(tokenAddress, context);

    // Update token popularity metrics
    await updateTokenPopularity(tokenAddress, event.params.value, context);

    // Process sender balance update (if not zero address)
    if (
      event.params.from.toString() !==
      "0x0000000000000000000000000000000000000000"
    ) {
      // Get current balance
      const senderId = `${event.params.from.toString()}-${tokenAddress}`;
      let senderBalance = await context.TokenBalance.get(senderId);

      // Calculate new balance
      const newBalance = senderBalance
        ? senderBalance.quantity - event.params.value
        : 0n - event.params.value;

      // Update sender balance
      await updateTokenBalance(
        event.params.from.toString(),
        tokenAddress,
        newBalance,
        context
      );
    }

    // Process receiver balance update
    // Get current balance
    const receiverId = `${event.params.to.toString()}-${tokenAddress}`;
    let receiverBalance = await context.TokenBalance.get(receiverId);

    // Calculate new balance
    const newBalance = receiverBalance
      ? receiverBalance.quantity + event.params.value
      : event.params.value;

    // Update receiver balance
    await updateTokenBalance(
      event.params.to.toString(),
      tokenAddress,
      newBalance,
      context
    );
  },
  {
    wildcard: true,
  }
);
