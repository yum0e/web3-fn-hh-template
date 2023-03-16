import { Log } from "@ethersproject/providers";
import { Web3Function, Web3FunctionContext } from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";
import ky from "ky";

const MAX_RANGE = 100; // limit range of events to comply with rpc providers
const MAX_REQUESTS = 100; // limit number of requests on every execution to avoid hitting timeout
const GITHUB_REGISTRY_ABI = [
  "event GitHubIdRegistered(uint256 indexed githubId)",
  "function computeNFTs(uint256[] memory, string[] memory)",
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, storage, multiChainProvider } = context;

  const provider = multiChainProvider.default();

  // Create githubRegistry
  const githubRegistryAddress =
    (userArgs.githubRegistry as string) ?? "0x71B9B0F6C999CBbB0FeF9c92B80D54e4973214da";
  const githubRegistry = new Contract(githubRegistryAddress, GITHUB_REGISTRY_ABI, provider);
  const topics = [githubRegistry.interface.getEventTopic("GitHubIdRegistered")];
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  // Retrieve last processed block number & nb events matched from storage
  const lastBlockStr = await storage.get("lastBlockNumber");
  let lastBlock = lastBlockStr ? parseInt(lastBlockStr) : currentBlock - 100;
  let totalEvents = parseInt((await storage.get("totalEvents")) ?? "0");
  console.log(`Last processed block: ${lastBlock}`);
  console.log(`Total events matched: ${totalEvents}`);

  // Fetch recent logs in range of 100 blocks
  const logs: Log[] = [];
  let nbRequests = 0;
  while (lastBlock < currentBlock && nbRequests < MAX_REQUESTS) {
    nbRequests++;
    const fromBlock = lastBlock + 1;
    const toBlock = Math.min(fromBlock + MAX_RANGE, currentBlock);
    console.log(`Fetching log events from blocks ${fromBlock} to ${toBlock}`);
    try {
      const eventFilter = {
        address: githubRegistryAddress,
        topics,
        fromBlock,
        toBlock,
      };
      const result = await provider.getLogs(eventFilter);
      logs.push(...result);
      lastBlock = toBlock;
    } catch (err) {
      return {
        canExec: false,
        message: `Rpc call failed: ${(err as Error).message}`,
      };
    }
  }

  // Parse retrieved events
  console.log(`Matched ${logs.length} new events`);
  const nbNewEvents = logs.length;
  totalEvents += logs.length;
  const githubApiKey = await context.secrets.get("GITHUB_API_KEY");
  if (!githubApiKey) {
    return { canExec: false, message: `GITHUB_API_KEY not set in secrets` };
  }
  const resolvedHandles: { [key: number]: string } = {};
  for (const log of logs) {
    const event = githubRegistry.interface.parseLog(log);
    const [githubId] = event.args;
    let githubHandle: string;
    try {
      const res = await ky.get(`https://api.github.com/user/${githubId}`, {
        headers: { Authorization: `Bearer ${githubApiKey}` },
      });
      ({ login: githubHandle } = (await res.json()) as { login: string });
      console.log(`GithubId ${githubId} resolved to github handle ${githubHandle}`);
    } catch (err) {
      console.log(`GithubId not resolved: ${githubId.toString()}`);
      continue;
    }
    resolvedHandles[githubId] = githubHandle;
  }

  // Update storage for next run
  await storage.set("lastBlockNumber", currentBlock.toString());
  await storage.set("totalEvents", totalEvents.toString());

  if (nbNewEvents === 0) {
    return {
      canExec: false,
      message: `Total events matched: ${totalEvents} (at block #${currentBlock.toString()})`,
    };
  }

  // Increase number of events matched on our OracleCounter contract
  return {
    canExec: true,
    callData: [
      {
        to: githubRegistryAddress,
        data: githubRegistry.interface.encodeFunctionData("computeNFTs", [
          Object.keys(resolvedHandles),
          Object.values(resolvedHandles),
        ]),
      },
    ],
  };
});
