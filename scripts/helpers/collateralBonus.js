const { request, gql } = require('graphql-request');
const Redis = require('ioredis');
require('dotenv').config();

// Variables based on MODES
const mode = process.env.MODE;
let GRAPH_URL;
let DB_BONUS;

if (mode === 'mainnet') {
    GRAPH_URL = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3';
    DB_BONUS = process.env.DB_BONUS_MAINNET; // Select DB 1
} else if (mode === 'mainnetOP') {
    GRAPH_URL = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism';
    DB_BONUS = process.env.DB_BONUS_OPTIMISM_MAINNET; // Select DB 7
}

// GraphQL query
const query = gql`
{
    reserves(where: {usageAsCollateralEnabled: true}) {
      id
      name
      price {
        id
      }
      liquidityRate
      variableBorrowRate
      stableBorrowRate
      reserveLiquidationBonus
    }
  } 
`;

// Connect to Redis
const redis = new Redis({
  port: 6379, // Redis port
  host: 'localhost', // Redis host
  db: DB_BONUS, 
});

// function to get the liquidation bonus
async function getLiquidationBonus() {
    data = await request(GRAPH_URL, query);
    // iterate through the data object to get the liquidation bonus
    for (let i = 0; i < data.reserves.length; i++) {
        console.log(data.reserves[i].reserveLiquidationBonus);
        console.log(data.reserves[i].price.id);
        //set the liquidation bonus in the Redis database, the key will be the reserve id and the value will be the liquidation bonus
        await redis.set(data.reserves[i].price.id, data.reserves[i].reserveLiquidationBonus);

        const value = await redis.get(data.reserves[i].price.id);
        console.log(`Retrieved  value: ${value}`);
    }    
    console.log('Done');
}


async function main() {
    await getLiquidationBonus();
    // Close the Redis connection
    redis.quit();
}

main();







