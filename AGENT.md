# AGENT.md - CCTP V2 Multichain Payment Gateway

## System Architecture Documentation

### Executive Summary
This document provides comprehensive operational guidelines for the CCTP V2 Multichain Payment Gateway implementation. All agents must adhere to these protocols to ensure consistent, secure, and efficient cross-chain USDC transfers utilizing Circle's Cross-Chain Transfer Protocol Version 2.

## Table of Contents
1. [Core System Components](#core-system-components)
2. [Implementation Protocols](#implementation-protocols)
3. [Verification Procedures](#verification-procedures)
4. [Error Handling Matrix](#error-handling-matrix)
5. [Testing Methodology](#testing-methodology)
6. [Production Operations](#production-operations)
7. [Compliance Framework](#compliance-framework)
8. [Emergency Procedures](#emergency-procedures)

## Core System Components

### 1.1 Protocol Architecture

#### 1.1.1 Smart Contract Interfaces
```solidity
// Message Transmitter Interface
interface IMessageTransmitter {
    function sendMessage(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes calldata messageBody
    ) external returns (uint64);
    
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool);
}

// Token Messenger Interface
interface ITokenMessenger {
    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller
    ) external returns (uint64);
    
    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes calldata hookData
    ) external returns (uint64);
}
```

#### 1.1.2 Chain Configuration Registry
| Chain | Chain ID | Domain | Message Transmitter | Token Messenger | USDC Contract |
|-------|----------|--------|-------------------|-----------------|---------------|
| Ethereum | 1 | 0 | `0x0a992d191DEeC32aFe36203Ad87D7d289a738F81` | `0xBd3fa81B58Ba92a82136038B25aDec7066af3155` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Arbitrum | 42161 | 3 | `0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca` | `0x19330d10D9Cc8751218eaf51E8885D058642E08A` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Base | 8453 | 6 | `0x1a58c91AAf06468eB4921Dd7b5B8293F2E20c03b` | `0xd203De32170130082896b4111eDF825a4774c18E` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Avalanche | 43114 | 1 | `0x8186359aF5F57FbB40c6b14A588d2A59C0C29880` | `0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982` | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| Linea | 59144 | 9 | `0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8` | `0xb1141bF80C0B5676c8a6e9f9c8F4dC4c8Fb8f7d0` | `0x176211869cA2b568f2A7D4EE941E073a821EE1ff` |
| Sonic | 146 | 10 | `0x1234567890abcdef1234567890abcdef12345678` | `0xabcdef1234567890abcdef1234567890abcdef12` | `0x29219dD400f2Bf60E5a23d13Be72B486D4038894` |

### 1.2 Hook System Architecture

#### 1.2.1 Hook Type Registry
```javascript
const HOOK_REGISTRY = {
  AUTO_SWAP: {
    id: '0x01',
    name: 'Auto Swap to Native Token',
    requiredParams: ['targetToken', 'slippageTolerance'],
    gasEstimate: 150000
  },
  AUTO_DEPOSIT: {
    id: '0x02',
    name: 'Auto Deposit to DeFi Protocol',
    requiredParams: ['protocolAddress', 'poolId'],
    gasEstimate: 200000
  },
  AUTO_STAKE: {
    id: '0x03',
    name: 'Auto Stake for Yield',
    requiredParams: ['stakingContract', 'lockPeriod'],
    gasEstimate: 180000
  },
  TREASURY_REBALANCE: {
    id: '0x04',
    name: 'Treasury Auto-Rebalance',
    requiredParams: ['distributionRules', 'threshold'],
    gasEstimate: 250000
  }
};
```

## Implementation Protocols

### 2.1 Transaction Lifecycle Management

#### 2.1.1 Pre-Transaction Validation Checklist
```javascript
const preTransactionValidation = async (params) => {
  const validationResults = {
    networkCheck: false,
    balanceCheck: false,
    allowanceCheck: false,
    gasEstimation: false,
    contractVerification: false
  };

  // Step 1: Network Verification
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  validationResults.networkCheck = (currentChainId === params.sourceChain.chainIdHex);
  
  // Step 2: Balance Verification
  const balance = await verifyUSDCBalance(params.account, params.sourceChain);
  validationResults.balanceCheck = (parseFloat(balance) >= parseFloat(params.amount));
  
  // Step 3: Allowance Verification
  const allowance = await checkCurrentAllowance(params);
  validationResults.allowanceCheck = (allowance >= params.amountInUnits);
  
  // Step 4: Gas Estimation
  const gasEstimate = await estimateTransactionGas(params);
  validationResults.gasEstimation = (gasEstimate > 0 && gasEstimate < params.gasLimit);
  
  // Step 5: Contract Address Verification
  validationResults.contractVerification = await verifyContractAddresses(params.sourceChain);
  
  return validationResults;
};
```

#### 2.1.2 Transaction Execution Sequence
```javascript
const executeTransaction = async (params) => {
  const executionLog = {
    timestamp: Date.now(),
    steps: []
  };

  try {
    // Phase 1: Approval Transaction
    executionLog.steps.push({
      phase: 'APPROVAL',
      status: 'INITIATED',
      timestamp: Date.now()
    });
    
    const approvalTx = await executeApproval(params);
    await waitForTransactionReceipt(approvalTx.hash);
    
    executionLog.steps.push({
      phase: 'APPROVAL',
      status: 'COMPLETED',
      txHash: approvalTx.hash,
      timestamp: Date.now()
    });

    // Phase 2: Burn Transaction
    executionLog.steps.push({
      phase: 'BURN',
      status: 'INITIATED',
      timestamp: Date.now()
    });
    
    const burnTx = await executeBurn(params);
    const burnReceipt = await waitForTransactionReceipt(burnTx.hash);
    
    executionLog.steps.push({
      phase: 'BURN',
      status: 'COMPLETED',
      txHash: burnTx.hash,
      nonce: extractNonceFromReceipt(burnReceipt),
      timestamp: Date.now()
    });

    // Phase 3: Attestation Monitoring
    executionLog.steps.push({
      phase: 'ATTESTATION',
      status: 'MONITORING',
      timestamp: Date.now()
    });
    
    const attestation = await monitorAttestation(burnReceipt);
    
    executionLog.steps.push({
      phase: 'ATTESTATION',
      status: 'RECEIVED',
      attestationData: attestation,
      timestamp: Date.now()
    });

    return {
      success: true,
      executionLog
    };
    
  } catch (error) {
    executionLog.steps.push({
      phase: 'ERROR',
      status: 'FAILED',
      error: error.message,
      timestamp: Date.now()
    });
    
    return {
      success: false,
      executionLog,
      error
    };
  }
};
```

### 2.2 ABI Encoding Specifications

#### 2.2.1 Function Signature Registry
```javascript
const FUNCTION_SIGNATURES = {
  // ERC20 Functions
  'approve(address,uint256)': '0x095ea7b3',
  'balanceOf(address)': '0x70a08231',
  'allowance(address,address)': '0xdd62ed3e',
  'decimals()': '0x313ce567',
  
  // CCTP V2 Functions
  'depositForBurnWithCaller(uint256,uint32,bytes32,address,bytes32)': '0x8c7af8a5',
  'depositForBurnWithHook(uint256,uint32,bytes32,address,bytes)': '0x1f9014c5',
  'sendMessage(uint32,bytes32,bytes)': '0x0ba469bc',
  'receiveMessage(bytes,bytes)': '0x57ecfd28'
};
```

#### 2.2.2 Parameter Encoding Functions
```javascript
const encodeParameters = {
  uint256: (value) => {
    const hex = BigInt(value).toString(16);
    return padHex(hex, 64);
  },
  
  uint32: (value) => {
    const hex = value.toString(16);
    return padHex(hex, 64);
  },
  
  address: (value) => {
    return padHex(value.slice(2), 64);
  },
  
  bytes32: (value) => {
    return value.slice(2);
  },
  
  bytes: (value) => {
    const data = value.slice(2);
    const length = (data.length / 2).toString(16);
    return padHex(length, 64) + data;
  }
};
```

## Verification Procedures

### 3.1 Contract Verification Protocol

#### 3.1.1 Address Validation
```javascript
const verifyContractAddresses = async (chainConfig) => {
  const verificationReport = {
    timestamp: Date.now(),
    chain: chainConfig.name,
    results: {}
  };

  // Verify each contract is deployed
  for (const [contractName, address] of Object.entries({
    messageTransmitter: chainConfig.messageTransmitter,
    tokenMessenger: chainConfig.tokenMessenger,
    usdc: chainConfig.usdc
  })) {
    const code = await window.ethereum.request({
      method: 'eth_getCode',
      params: [address, 'latest']
    });
    
    verificationReport.results[contractName] = {
      address,
      isDeployed: code !== '0x',
      codeHash: web3.utils.keccak256(code)
    };
  }

  return verificationReport;
};
```

#### 3.1.2 Domain Mapping Verification
```javascript
const verifyDomainMappings = () => {
  const domainVerification = {
    conflicts: [],
    validated: []
  };

  const domainMap = new Map();
  
  for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
    if (domainMap.has(config.domain)) {
      domainVerification.conflicts.push({
        domain: config.domain,
        chains: [domainMap.get(config.domain), config.name]
      });
    } else {
      domainMap.set(config.domain, config.name);
      domainVerification.validated.push({
        chain: config.name,
        chainId,
        domain: config.domain
      });
    }
  }

  return domainVerification;
};
```

### 3.2 Balance Verification System

#### 3.2.1 Multi-Chain Balance Aggregation
```javascript
const aggregateBalances = async (userAddress) => {
  const balanceReport = {
    timestamp: Date.now(),
    address: userAddress,
    balances: {},
    total: '0',
    errors: []
  };

  for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
    try {
      const balance = await queryUSDCBalance(userAddress, config);
      balanceReport.balances[chainId] = {
        chain: config.name,
        balance,
        formatted: formatUSDC(balance)
      };
    } catch (error) {
      balanceReport.errors.push({
        chain: config.name,
        error: error.message
      });
      balanceReport.balances[chainId] = {
        chain: config.name,
        balance: '0',
        formatted: '0.00'
      };
    }
  }

  // Calculate total
  balanceReport.total = Object.values(balanceReport.balances)
    .reduce((sum, item) => sum + parseFloat(item.balance), 0)
    .toFixed(2);

  return balanceReport;
};
```

## Error Handling Matrix

### 4.1 Error Classification System

#### 4.1.1 Error Type Registry
```javascript
const ERROR_TYPES = {
  NETWORK_ERROR: {
    code: 'E001',
    severity: 'HIGH',
    category: 'INFRASTRUCTURE',
    retryable: true
  },
  INSUFFICIENT_BALANCE: {
    code: 'E002',
    severity: 'MEDIUM',
    category: 'USER',
    retryable: false
  },
  CONTRACT_ERROR: {
    code: 'E003',
    severity: 'CRITICAL',
    category: 'PROTOCOL',
    retryable: false
  },
  ATTESTATION_TIMEOUT: {
    code: 'E004',
    severity: 'HIGH',
    category: 'EXTERNAL',
    retryable: true
  },
  HOOK_EXECUTION_FAILURE: {
    code: 'E005',
    severity: 'MEDIUM',
    category: 'PROTOCOL',
    retryable: false
  }
};
```

#### 4.1.2 Error Resolution Procedures
```javascript
const errorResolutionProcedures = {
  E001: {
    description: 'Network connectivity or RPC failure',
    diagnosticSteps: [
      'Verify RPC endpoint availability',
      'Check network congestion status',
      'Validate chain ID configuration'
    ],
    resolutionSteps: [
      'Switch to backup RPC endpoint',
      'Implement exponential backoff retry',
      'Alert user of network issues'
    ],
    escalation: 'Infrastructure team notification after 3 failures'
  },
  
  E002: {
    description: 'User USDC balance insufficient for transaction',
    diagnosticSteps: [
      'Re-query current balance',
      'Verify decimal precision',
      'Check for pending transactions'
    ],
    resolutionSteps: [
      'Display current balance to user',
      'Suggest amount adjustment',
      'Provide funding instructions'
    ],
    escalation: 'None - user action required'
  },
  
  E003: {
    description: 'Smart contract interaction failure',
    diagnosticSteps: [
      'Verify contract addresses',
      'Check ABI encoding',
      'Validate gas estimation'
    ],
    resolutionSteps: [
      'Log full transaction data',
      'Capture error stack trace',
      'Initiate emergency protocol'
    ],
    escalation: 'Immediate technical team alert'
  },
  
  E004: {
    description: 'Attestation not received within expected timeframe',
    diagnosticSteps: [
      'Verify burn transaction success',
      'Check attestation service status',
      'Validate message hash'
    ],
    resolutionSteps: [
      'Continue polling with backoff',
      'Alert user of delay',
      'Provide transaction tracking'
    ],
    escalation: 'Circle support contact after 30 minutes'
  },
  
  E005: {
    description: 'Hook execution failed on destination chain',
    diagnosticSteps: [
      'Verify hook contract deployment',
      'Check hook data encoding',
      'Validate gas allocation'
    ],
    resolutionSteps: [
      'Log hook failure details',
      'Notify user of partial completion',
      'Provide manual intervention steps'
    ],
    escalation: 'Development team investigation'
  }
};
```

### 4.2 Error Recovery Mechanisms

#### 4.2.1 Automatic Recovery Protocol
```javascript
const automaticRecovery = async (error, context) => {
  const recoveryLog = {
    errorCode: error.code,
    attempts: [],
    finalStatus: null
  };

  const errorConfig = ERROR_TYPES[error.type];
  
  if (!errorConfig.retryable) {
    recoveryLog.finalStatus = 'MANUAL_INTERVENTION_REQUIRED';
    return recoveryLog;
  }

  const maxAttempts = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    recoveryLog.attempts.push({
      attemptNumber: attempt,
      timestamp: Date.now(),
      status: 'ATTEMPTING'
    });
    
    try {
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1))
      );
      
      // Retry operation
      const result = await retryOperation(context);
      
      recoveryLog.attempts[attempt - 1].status = 'SUCCESS';
      recoveryLog.finalStatus = 'RECOVERED';
      return recoveryLog;
      
    } catch (retryError) {
      recoveryLog.attempts[attempt - 1].status = 'FAILED';
      recoveryLog.attempts[attempt - 1].error = retryError.message;
    }
  }
  
  recoveryLog.finalStatus = 'RECOVERY_FAILED';
  return recoveryLog;
};
```

## Testing Methodology

### 5.1 Unit Testing Specifications

#### 5.1.1 Core Function Tests
```javascript
const unitTestSuite = {
  helperFunctions: {
    'toHex': {
      testCases: [
        { input: 0, expected: '0x0' },
        { input: 255, expected: '0xff' },
        { input: 1000000, expected: '0xf4240' }
      ],
      validate: (result, expected) => result === expected
    },
    
    'padHex': {
      testCases: [
        { input: ['ff', 4], expected: '00ff' },
        { input: ['1234', 8], expected: '00001234' },
        { input: ['abcdef', 6], expected: 'abcdef' }
      ],
      validate: (result, expected) => result === expected
    },
    
    'addressToBytes32': {
      testCases: [
        { 
          input: '0x742d35Cc6634C0532925a3b844Bc9e7595f8C2B2',
          expected: '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8c2b2'
        }
      ],
      validate: (result, expected) => result.toLowerCase() === expected.toLowerCase()
    }
  },
  
  abiEncoding: {
    'approve': {
      testCases: [
        {
          input: {
            spender: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
            amount: 1000000 // 1 USDC
          },
          expected: '0x095ea7b3000000000000000000000000bd3fa81b58ba92a82136038b25adec7066af315500000000000000000000000000000000000000000000000000000000000f4240'
        }
      ],
      validate: (result, expected) => result.toLowerCase() === expected.toLowerCase()
    }
  }
};
```

#### 5.1.2 Integration Test Protocol
```javascript
const integrationTests = {
  walletConnection: {
    prerequisites: ['MetaMask installed', 'Test account available'],
    steps: [
      'Initialize wallet connection',
      'Verify account retrieval',
      'Confirm network detection',
      'Validate event listener attachment'
    ],
    expectedOutcomes: [
      'Account address retrieved',
      'Chain ID correctly identified',
      'Balance query successful'
    ]
  },
  
  crossChainTransfer: {
    prerequisites: ['Testnet USDC balance', 'Both chains configured'],
    steps: [
      'Select source chain (Sepolia)',
      'Select destination chain (Arbitrum Sepolia)',
      'Enter transfer amount',
      'Execute approval transaction',
      'Execute burn transaction',
      'Monitor attestation',
      'Verify mint on destination'
    ],
    expectedOutcomes: [
      'Approval event emitted',
      'Burn event with nonce',
      'Attestation received',
      'Balance updated on destination'
    ]
  }
};
```

### 5.2 End-to-End Testing Framework

#### 5.2.1 Test Environment Configuration
```javascript
const testEnvironmentConfig = {
  networks: {
    sepolia: {
      chainId: 11155111,
      rpcUrl: process.env.SEPOLIA_RPC_URL,
      contracts: {
        messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
        tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      }
    },
    arbitrumSepolia: {
      chainId: 421614,
      rpcUrl: process.env.ARB_SEPOLIA_RPC_URL,
      contracts: {
        messageTransmitter: '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872',
        tokenMessenger: '0x12dcfd3fe2e9eac2859fd1ed86d2ab8c5a2f9352',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
      }
    }
  },
  testAccounts: {
    sender: process.env.TEST_SENDER_ADDRESS,
    recipient: process.env.TEST_RECIPIENT_ADDRESS
  },
  faucets: {
    sepolia: 'https://faucet.circle.com/',
    arbitrumSepolia: 'https://faucet.circle.com/'
  }
};
```

#### 5.2.2 Automated Test Execution
```javascript
const executeE2ETestSuite = async () => {
  const testReport = {
    startTime: Date.now(),
    environment: 'TESTNET',
    results: []
  };

  const testScenarios = [
    {
      name: 'Standard Transfer',
      params: {
        amount: '10',
        fastTransfer: false,
        hook: null
      }
    },
    {
      name: 'Fast Transfer with Auto-Swap Hook',
      params: {
        amount: '25',
        fastTransfer: true,
        hook: 'AUTO_SWAP'
      }
    },
    {
      name: 'Treasury Rebalance',
      params: {
        amount: '100',
        fastTransfer: true,
        hook: 'TREASURY_REBALANCE'
      }
    }
  ];

  for (const scenario of testScenarios) {
    const scenarioResult = await runTestScenario(scenario);
    testReport.results.push(scenarioResult);
  }

  testReport.endTime = Date.now();
  testReport.duration = testReport.endTime - testReport.startTime;
  testReport.summary = generateTestSummary(testReport.results);

  return testReport;
};
```

## Production Operations

### 6.1 Deployment Procedures

#### 6.1.1 Pre-Deployment Checklist
```yaml
pre_deployment_checklist:
  infrastructure:
    - [ ] Primary RPC endpoints configured
    - [ ] Backup RPC endpoints configured
    - [ ] Load balancer configuration verified
    - [ ] SSL certificates valid
    - [ ] DDoS protection enabled
  
  smart_contracts:
    - [ ] All contract addresses verified against Circle documentation
    - [ ] Domain mappings validated
    - [ ] ABI interfaces confirmed
    - [ ] Gas estimation parameters set
  
  monitoring:
    - [ ] Transaction monitoring dashboard deployed
    - [ ] Alert thresholds configured
    - [ ] Log aggregation enabled
    - [ ] Performance metrics collection active
  
  security:
    - [ ] Input validation rules implemented
    - [ ] Rate limiting configured
    - [ ] CORS policies set
    - [ ] CSP headers configured
```

#### 6.1.2 Deployment Validation
```javascript
const validateDeployment = async () => {
  const validationReport = {
    timestamp: Date.now(),
    checks: {}
  };

  // RPC Connectivity
  validationReport.checks.rpcConnectivity = await Promise.all(
    Object.entries(CHAIN_CONFIG).map(async ([chainId, config]) => {
      try {
        const blockNumber = await queryBlockNumber(config.rpcUrl);
        return {
          chain: config.name,
          status: 'CONNECTED',
          blockNumber
        };
      } catch (error) {
        return {
          chain: config.name,
          status: 'FAILED',
          error: error.message
        };
      }
    })
  );

  // Contract Verification
  validationReport.checks.contractVerification = await Promise.all(
    Object.entries(CHAIN_CONFIG).map(async ([chainId, config]) => {
      const verification = await verifyContractAddresses(config);
      return {
        chain: config.name,
        verification
      };
    })
  );

  // Performance Baseline
  validationReport.checks.performanceBaseline = await measurePerformanceMetrics();

  return validationReport;
};
```

### 6.2 Monitoring and Alerting

#### 6.2.1 Key Performance Indicators
```javascript
const KPI_DEFINITIONS = {
  transactionSuccessRate: {
    metric: 'successful_transactions / total_transactions',
    threshold: 0.95,
    window: '5m',
    alert: 'CRITICAL'
  },
  
  averageSettlementTime: {
    metric: 'avg(settlement_time)',
    threshold: {
      standard: 900, // 15 minutes
      fast: 30 // 30 seconds
    },
    window: '15m',
    alert: 'WARNING'
  },
  
  attestationServiceLatency: {
    metric: 'attestation_receipt_time - burn_completion_time',
    threshold: {
      standard: 300, // 5 minutes
      fast: 15 // 15 seconds
    },
    window: '5m',
    alert: 'WARNING'
  },
  
  hookExecutionFailureRate: {
    metric: 'failed_hooks / total_hooks',
    threshold: 0.05,
    window: '1h',
    alert: 'WARNING'
  },
  
  gasUtilizationEfficiency: {
    metric: 'actual_gas_used / estimated_gas',
    threshold: {
      min: 0.8,
      max: 1.2
    },
    window: '30m',
    alert: 'INFO'
  }
};
```

#### 6.2.2 Alert Configuration
```javascript
const alertConfiguration = {
  channels: {
    critical: ['pagerduty', 'slack-critical', 'email-oncall'],
    warning: ['slack-alerts', 'email-team'],
    info: ['slack-monitoring', 'dashboard']
  },
  
  rules: [
    {
      name: 'Transaction Failure Spike',
      condition: 'transactionSuccessRate < 0.90',
      severity: 'CRITICAL',
      actions: [
        'Page on-call engineer',
        'Create incident ticket',
        'Enable circuit breaker'
      ]
    },
    {
      name: 'Attestation Service Degradation',
      condition: 'attestationServiceLatency > threshold * 2',
      severity: 'WARNING',
      actions: [
        'Notify team',
        'Switch to standard transfer mode',
        'Monitor recovery'
      ]
    },
    {
      name: 'Hook Execution Anomaly',
      condition: 'hookExecutionFailureRate > 0.10',
      severity: 'WARNING',
      actions: [
        'Disable affected hook type',
        'Alert development team',
        'Log detailed diagnostics'
      ]
    }
  ]
};
```

## Compliance Framework

### 7.1 Transaction Recording Requirements

#### 7.1.1 Mandatory Data Points
```javascript
const transactionRecord = {
  // Transaction Identifiers
  internalId: 'UUID-v4',
  burnTxHash: '0x...',
  mintTxHash: '0x...',
  cctpNonce: 'uint64',
  
  // Participant Information
  senderAddress: '0x...',
  senderChain: 'Ethereum',
  recipientAddress: '0x...',
  recipientChain: 'Arbitrum',
  
  // Transaction Details
  amount: '1000.00',
  currency: 'USDC',
  transferType: 'FAST_TRANSFER',
  hookType: 'TREASURY_REBALANCE',
  
  // Timestamps
  initiatedAt: 'ISO-8601',
  approvedAt: 'ISO-8601',
  burnedAt: 'ISO-8601',
  attestedAt: 'ISO-8601',
  mintedAt: 'ISO-8601',
  completedAt: 'ISO-8601',
  
  // Compliance Metadata
  ipAddress: 'xxx.xxx.xxx.xxx',
  userAgent: 'Browser/Version',
  sessionId: 'UUID-v4',
  complianceFlags: []
};
```

#### 7.1.2 Data Retention Policy
```javascript
const dataRetentionPolicy = {
  transactionRecords: {
    retentionPeriod: '7 years',
    storageLocation: 'Encrypted database',
    backupFrequency: 'Daily',
    archivalProcess: 'Annual migration to cold storage'
  },
  
  userActivityLogs: {
    retentionPeriod: '1 year',
    storageLocation: 'Log management system',
    compressionPolicy: 'After 30 days',
    deletionProcess: 'Automated purge after retention period'
  },
  
  systemMetrics: {
    retentionPeriod: '90 days',
    aggregationLevels: ['1m', '5m', '1h', '1d'],
    downsamplingPolicy: 'Progressive reduction after 7 days'
  }
};
```

### 7.2 Audit Trail Implementation

#### 7.2.1 Event Logging Specification
```javascript
const auditEventTypes = {
  USER_ACTIONS: [
    'WALLET_CONNECTED',
    'WALLET_DISCONNECTED',
    'TRANSACTION_INITIATED',
    'TRANSACTION_APPROVED',
    'TRANSACTION_CANCELLED',
    'NETWORK_SWITCHED',
    'SETTINGS_MODIFIED'
  ],
  
  SYSTEM_EVENTS: [
    'TRANSACTION_BROADCASTED',
    'TRANSACTION_CONFIRMED',
    'ATTESTATION_REQUESTED',
    'ATTESTATION_RECEIVED',
    'HOOK_EXECUTED',
    'ERROR_OCCURRED',
    'RECOVERY_ATTEMPTED'
  ],
  
  COMPLIANCE_EVENTS: [
    'THRESHOLD_EXCEEDED',
    'SUSPICIOUS_PATTERN_DETECTED',
    'MANUAL_REVIEW_REQUIRED',
    'COMPLIANCE_OVERRIDE_APPLIED'
  ]
};

const logAuditEvent = (eventType, eventData) => {
  const auditEntry = {
    eventId: generateEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    eventData,
    contextData: {
      sessionId: getCurrentSessionId(),
      userId: getCurrentUserId(),
      ipAddress: getClientIpAddress(),
      userAgent: getUserAgent()
    },
    signature: generateEventSignature(eventData)
  };
  
  return persistAuditEntry(auditEntry);
};
```

## Emergency Procedures

### 8.1 Incident Response Protocol

#### 8.1.1 Severity Classification
```javascript
const incidentSeverityLevels = {
  SEV1: {
    description: 'Complete service outage or critical security breach',
    responseTime: '15 minutes',
    escalation: 'Immediate C-level notification',
    examples: [
      'All transactions failing',
      'Smart contract vulnerability exploited',
      'Complete attestation service failure'
    ]
  },
  
  SEV2: {
    description: 'Major functionality degraded or partial outage',
    responseTime: '30 minutes',
    escalation: 'Engineering leadership notification',
    examples: [
      'Single chain unavailable',
      'Hook execution failures > 50%',
      'Significant performance degradation'
    ]
  },
  
  SEV3: {
    description: 'Minor functionality impact or isolated issues',
    responseTime: '2 hours',
    escalation: 'Team lead notification',
    examples: [
      'Intermittent RPC failures',
      'UI rendering issues',
      'Non-critical feature malfunction'
    ]
  }
};
```

#### 8.1.2 Emergency Response Procedures
```javascript
const emergencyResponseProcedures = {
  immediateActions: [
    {
      step: 1,
      action: 'Activate incident response team',
      responsibility: 'On-call engineer',
      sla: '5 minutes'
    },
    {
      step: 2,
      action: 'Assess impact and severity',
      responsibility: 'Incident commander',
      sla: '10 minutes'
    },
    {
      step: 3,
      action: 'Implement circuit breaker if necessary',
      responsibility: 'Senior engineer',
      sla: '15 minutes'
    },
    {
      step: 4,
      action: 'Notify stakeholders',
      responsibility: 'Communications lead',
      sla: '20 minutes'
    }
  ],
  
  containmentActions: [
    'Disable affected functionality',
    'Route traffic to backup systems',
    'Increase monitoring verbosity',
    'Preserve system state for analysis'
  ],
  
  recoveryActions: [
    'Identify root cause',
    'Develop and test fix',
    'Deploy patch with validation',
    'Monitor for regression'
  ],
  
  postIncidentActions: [
    'Conduct blameless postmortem',
    'Update runbooks',
    'Implement preventive measures',
    'Share learnings with team'
  ]
};
```

### 8.2 Business Continuity Plan

#### 8.2.1 Failover Procedures
```javascript
const failoverProcedures = {
  rpcFailover: {
    trigger: 'Primary RPC unresponsive for 30 seconds',
    action: 'Automatic switch to backup RPC',
    validation: 'Verify block height synchronization',
    rollback: 'Manual intervention required'
  },
  
  attestationServiceFailover: {
    trigger: 'No attestations received for 5 minutes',
    action: 'Switch to standard transfer mode',
    notification: 'Alert users of extended settlement times',
    recovery: 'Resume fast transfers when service restored'
  },
  
  chainSpecificFailover: {
    trigger: 'Single chain unavailable',
    action: 'Disable chain from selection',
    communication: 'Display maintenance message',
    monitoring: 'Check restoration every 5 minutes'
  }
};
```

#### 8.2.2 Data Recovery Procedures
```javascript
const dataRecoveryProcedures = {
  transactionRecovery: {
    dataSource: 'Blockchain event logs',
    recoveryMethod: 'Event replay from last checkpoint',
    validationSteps: [
      'Verify transaction hashes',
      'Confirm nonce sequences',
      'Validate attestation records'
    ]
  },
  
  stateRecovery: {
    backupFrequency: 'Every 4 hours',
    backupRetention: '7 days',
    recoverySteps: [
      'Identify last known good state',
      'Restore from backup',
      'Replay transactions from that point',
      'Verify consistency'
    ]
  }
};
```

## Appendix A: Quick Reference

### Contract Function Selectors
```
approve: 0x095ea7b3
depositForBurnWithCaller: 0x8c7af8a5
depositForBurnWithHook: 0x1f9014c5
```

### Domain Mappings
```
Ethereum: 0
Avalanche: 1
Arbitrum: 3
Base: 6
Linea: 9
Sonic: 10
```

### Critical Contacts
```
Circle Support: support@circle.com
Technical Escalation: [Internal contact]
Security Team: [Internal contact]
```

---

**Document Version**: 1.0.0  
**Last Updated**: June 2025  
**Next Review**: September 2025  
**Owner**: CCTP Integration Team

This document serves as the authoritative operational guide for the CCTP V2 Multichain Payment Gateway. All modifications must be approved by the technical leadership team and documented in the revision history.
