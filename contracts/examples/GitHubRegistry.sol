// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract GitHubRegistry {
  event GitHubIdRegistered(uint256 indexed githubId);
  error InvalidInputLegnths();

  uint32 public lastUpdated;

  function register(uint256 githubId) external {
    emit GitHubIdRegistered(githubId);
  }

  function computeNFTs(uint256[] memory id, string[] memory githubHandles) external {
    if (id.length != githubHandles.length) {
      revert InvalidInputLegnths();
    }
    lastUpdated = uint32(block.timestamp);
  }

  function getLastUpdated() external view returns (uint32) {
    return lastUpdated;
  }
}
