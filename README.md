# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```




Testnet Aave V3 addresses: https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
Mainnet Aave V3 addresses: https://docs.aave.com/developers/deployed-contracts/v3-mainnet/ethereum-mainnet
Index for all mainnet (and L2) addresses: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
Liuidation Aave Guide: https://docs.aave.com/developers/guides/liquidations
Guide on how to format graph output to get real time data such as healt factor: https://github.com/aave/aave-utilities#subgraph

AaveV2 Queries endpoint: https://api.thegraph.com/subgraphs/name/aave/protocol-v2
Oficial AaveV2 graph data examples: https://docs.aave.com/developers/v/2.0/getting-started/using-graphql
Oficial AaveV2 graph playGround: https://thegraph.com/hosted-service/subgraph/aave/protocol-v2?version=current
The Graph oficial clients info: https://thegraph.com/docs/en/querying/querying-from-an-application/
AaveQL examples of queries: https://www.aaveql.org/docs/Ethereum-v2/examples


Oficial AaveV3 Graph Playground: https://thegraph.com/hosted-service/subgraph/aave/protocol-v3
AaveV3 Queries endpoint: https://api.thegraph.com/subgraphs/name/aave/protocol-v3
Aave Official Github Subgraphs repo(you can find good examples): https://github.com/aave/protocol-subgraphs?tab=readme-ov-file


Aave address book plug in to install: https://github.com/bgd-labs/aave-address-book
Aave utilities plug in to format important data: https://github.com/aave/aave-utilities#formatusersummary

uiPoolDataProviderAddress = 0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE // testnet
PoolAdressProvider = 0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A / testner
pool = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951 // testnet

uiPoolDataProviderAddress = 0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d //Mainnet 
PoolAdressProvider = 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e // Mainnet
Pool = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 // mainnet



average Optimism gas estimation: 0.000031248320856828 eth.
gas units used: 1049889
gas units used: 772295


SEPOLIA BRAZO EJECUTOR ADDRESS: 0xc4b956988F443Ca70c36a2832722D64902A7A9Ad

Instructions:

- Turn On the Redis database so the bot.js file can access the require data