require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 30000000
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      gas: 30000000,
      gasPrice: 20000000000
    }
  }
};
