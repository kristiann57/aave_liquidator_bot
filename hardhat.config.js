require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomicfoundation/hardhat-foundry");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
      },
      {
        version: "0.8.21",
        settings: {},
      },
    ],
  },

  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC_URL_TESTNET,
        blockNumber: 5340855,
      },
    },
  },
};
