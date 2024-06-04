
const BrazoEjecutorABI =  [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_pool",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "uiPoolDataProviderAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_PoolAddressesProvider",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_swapRouter",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "addressesList",
        "type": "address[]"
      }
    ],
    "name": "areLiquidatable",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "healthFactor",
            "type": "uint256"
          }
        ],
        "internalType": "struct BrazoEjecutor.liquidatableUserInfo[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "asset",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "premium",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "initiator",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "params",
        "type": "bytes"
      }
    ],
    "name": "executeOperation",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "addressesList",
        "type": "address[]"
      }
    ],
    "name": "getUserReservesData",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "underlyingAsset",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "scaledATokenBalance",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "usageAsCollateralEnabledOnUser",
            "type": "bool"
          },
          {
            "internalType": "uint256",
            "name": "stableBorrowRate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "scaledVariableDebt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "principalStableDebt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "stableBorrowLastUpdateTimestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct IUiPoolDataProviderV3.UserReserveData[][]",
        "name": "",
        "type": "tuple[][]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "collateralAsset",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "debtAsset",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "liquidatableUser",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "debtToCover",
        "type": "uint256"
      }
    ],
    "name": "liquidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "swapRouter",
    "outputs": [
      {
        "internalType": "contract ISwapRouter",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]     

// export the BrazoEjecutorABI
module.exports = BrazoEjecutorABI;