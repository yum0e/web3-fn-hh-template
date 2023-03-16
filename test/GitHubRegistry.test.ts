import hre from "hardhat";
import { expect } from "chai";
import { GitHubRegistry } from "../typechain";
import { before } from "mocha";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Web3FunctionUserArgs, Web3FunctionResultV2 } from "@gelatonetwork/web3-functions-sdk";
import { Web3FunctionHardhat } from "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
const { ethers, deployments, w3f } = hre;

describe("GitHubRegistry Tests", function () {
  this.timeout(0);

  let owner: SignerWithAddress;

  let githubRegistry: GitHubRegistry;
  let oracleW3f: Web3FunctionHardhat;
  let userArgs: Web3FunctionUserArgs;

  before(async function () {
    await deployments.fixture(["GitHubRegistry"]);

    [owner] = await hre.ethers.getSigners();

    githubRegistry = await ethers.getContract("GitHubRegistry");
    oracleW3f = w3f.get("github-registry");

    userArgs = {
      githubRegistry: githubRegistry.address,
    };
  });

  it("canExec: true - First execution", async () => {
    await githubRegistry.register(99990370);

    let { result } = await oracleW3f.run({ userArgs });
    result = result as Web3FunctionResultV2;

    expect(result.canExec).to.equal(true);
    if (!result.canExec) throw new Error("!result.canExec");

    const calldata = result.callData[0];
    await owner.sendTransaction({ to: calldata.to, data: calldata.data });
  });

  it("canExec: false - After execution", async () => {
    let { result } = await oracleW3f.run({ storage: { lastBlockNumber: "8664002" }, userArgs });
    result = result as Web3FunctionResultV2;

    expect(result.canExec).to.equal(false);
    if (result.canExec) throw new Error("result.canExec");

    const message = result.message;
    expect(message).to.equal("Total events matched: 0 (at block #8664003)");
  });

  it("canExec: true - Time elapsed", async () => {
    const ONE_HOUR = 60 * 60;
    await time.increase(ONE_HOUR);

    const { result } = await oracleW3f.run({ userArgs });
    expect(result.canExec).to.equal(true);
  });
});
