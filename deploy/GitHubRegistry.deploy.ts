import { deployments, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== "hardhat") {
    console.log(`Deploying GitHubRegistry to ${hre.network.name}. Hit ctrl + c to abort`);
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("GitHubRegistry", {
    from: deployer,
    log: hre.network.name !== "hardhat",
  });
};

export default func;

func.tags = ["GitHubRegistry"];
