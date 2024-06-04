const { ethers } = require('ethers');
// import dotenv
require('dotenv').config();
const AavePoolABI = require('../ABIs/AavePoolABI.js');
const AaveUiPoolDataProviderV3ABI = require('../ABIs/AaveUiDataProviderV3ABI.js');
//import ioredis
const Redis = require('ioredis');
// Connect to Redis
const client = new Redis({
    port: 6379, // Redis port
    host: 'localhost', // Redis host
    db: 3, // Select DB 3
});

////////////////////////////////////////////
// Contracts & provider initialization /////
////////////////////////////////////////////
// get provider URL from .env
const RPC_URL_TESNET = process.env.RPC_URL_TESTNET;

// get a provider
const provider = new ethers.providers.JsonRpcProvider(RPC_URL_TESNET);

const AavePoolAddress = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; //Sepolia address
const AaveUiPoolDataProviderV3Address = "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE"; // Sepolia address
const AavePoolAddressProvider = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"; // Sepolia address

// create a contract instance
const AavePoolContract = new ethers.Contract(AavePoolAddress, AavePoolABI, provider);

// create a contract instance for the AaveUiPoolDataProviderV3
const contractDataProvider = new ethers.Contract(AaveUiPoolDataProviderV3Address, AaveUiPoolDataProviderV3ABI, provider);


////////////////////////////////////////////
// LOGIC: Extracting Reserves List of Aave /
////////////////////////////////////////////

// get reserves list
async function getReservesList() {
    return await contractDataProvider.getReservesList(AavePoolAddressProvider);
}



// loop through the reserves list and get the liquidation bonus
// reserves with no liquidation bonus will be ignored
// reserves with liquidation bonus will be set in the Redis database
async function getLiquidationBonus() {
    const reserves = await getReservesList();
    console.log(reserves);
    for (let i = 0; i < reserves.length; i++) {
        const reserve = reserves[i];
        let liquidationBonus = await AavePoolContract.getConfiguration(reserve);
        liquidationBonus = extractLiquidationBonus(liquidationBonus.toString());
        
        if (liquidationBonus != 0) {
            await client.set(reserve, liquidationBonus);
            const value = await client.get(reserve);
            console.log(`Retrieved  value: ${value}`);
        }
    }
    console.log('Done');
}

//////////////////////////////////////////////////
// Extract Liquidation off the bytes returned //// 
//////////////////////////////////////////////////


// function to extract the liquidation bonus from the bytes returned
function extractLiquidationBonus(LongNuber) {
    let config = ethers.BigNumber.from(LongNuber);
    // Create a mask for the liquidation bonus bits (32-47)
    const liquidationBonusMask = ethers.BigNumber.from('1').shl(48).sub('1').sub(ethers.BigNumber.from('1').shl(32).sub('1'));

    // Apply the mask to the configuration and shift it right by 32 bits to get the liquidation bonus
    const liquidationBonus = config.and(liquidationBonusMask).shr(32);

    return liquidationBonus.toString();
}

//////////////////////////////////////////////////
// MAIN FUNCTION ///////////////////////////////// 
//////////////////////////////////////////////////

async function main() {
    await getLiquidationBonus();
    // Close the Redis connection
    client.quit();
}
main();