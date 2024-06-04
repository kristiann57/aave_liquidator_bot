// Script to go through the Redis DB and quering the graph to see if the user has anythign borrowed in the protocol at the moment
// if nothing is borrowed, then we can remove the user from the DB
// scrpt to be run nghtly
//Using graphql-request module
const { request, gql } = require('graphql-request');

// GraphQL query
const query = gql`
    { 
        flashLoans( 
          first: 5 
          orderBy: timestamp 
          orderDirection: desc 
        ) { 
          id 
          reserve { 
            id 
            name 
            symbol 
          } 
          amount 
          totalFee 
          timestamp 
        } 
      } 
    `;

request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query).then((data) => console.log(data));