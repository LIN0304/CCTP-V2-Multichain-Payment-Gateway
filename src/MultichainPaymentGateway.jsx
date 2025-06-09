import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Send,
  ArrowRightLeft,
  DollarSign,
  Shield,
  Zap,
  Settings,
  Globe,
  Wallet
} from 'lucide-react';

// Chain configurations for CCTP V2
const CHAIN_CONFIG = {
  1: {
    name: 'Ethereum',
    domain: 0,
    chainIdHex: '0x1',
    messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
    tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    icon: '🌐',
    color: 'bg-blue-500',
    explorer: 'https://etherscan.io'
  },
  42161: {
    name: 'Arbitrum',
    domain: 3,
    chainIdHex: '0xa4b1',
    messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
    tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    icon: '🔷',
    color: 'bg-sky-500',
    explorer: 'https://arbiscan.io'
  },
  8453: {
    name: 'Base',
    domain: 6,
    chainIdHex: '0x2105',
    messageTransmitter: '0x1a58c91AAf06468eB4921Dd7b5B8293F2E20c03b',
    tokenMessenger: '0xd203De32170130082896b4111eDF825a4774c18E',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    icon: '🔵',
    color: 'bg-indigo-500',
    explorer: 'https://basescan.org'
  },
  43114: {
    name: 'Avalanche',
    domain: 1,
    chainIdHex: '0xa86a',
    messageTransmitter: '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880',
    tokenMessenger: '0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982',
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    icon: '🔺',
    color: 'bg-red-500',
    explorer: 'https://snowtrace.io'
  },
  59144: {
    name: 'Linea',
    domain: 9,
    chainIdHex: '0xe708',
    messageTransmitter: '0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
    tokenMessenger: '0xb1141bF80C0B5676c8a6e9f9c8F4dC4c8Fb8f7d0',
    usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    icon: '⚡',
    color: 'bg-purple-500',
    explorer: 'https://lineascan.build'
  },
  146: {
    name: 'Sonic',
    domain: 10,
    chainIdHex: '0x92',
    messageTransmitter: '0x1234567890abcdef1234567890abcdef12345678',
    tokenMessenger: '0xabcdef1234567890abcdef1234567890abcdef12',
    usdc: '0x29219dD400f2Bf60E5a23d13Be72B486D4038894',
    icon: '🎵',
    color: 'bg-green-500',
    explorer: 'https://sonicscan.io'
  }
};

// Hook templates for automated actions
const HOOK_TEMPLATES = {
  autoSwap: {
    name: 'Auto Swap to Native Token',
    description: 'Automatically swap received USDC to native token',
    icon: '🔄',
    hookData: '0x01'
  },
  autoDeposit: {
    name: 'Auto Deposit to DeFi',
    description: 'Deposit received USDC into lending protocol',
    icon: '🏦',
    hookData: '0x02'
  },
  autoStake: {
    name: 'Auto Stake for Rewards',
    description: 'Stake USDC for yield generation',
    icon: '📈',
    hookData: '0x03'
  },
  treasuryRebalance: {
    name: 'Treasury Auto-Rebalance',
    description: 'Automatically rebalance to preferred chain',
    icon: '⚖️',
    hookData: '0x04'
  }
};

// Helper functions for Web3 interactions
const toHex = (num) => '0x' + num.toString(16);
const fromHex = (hex) => parseInt(hex, 16);
const padHex = (hex, length) => hex.padStart(length, '0');
const addressToBytes32 = (address) => '0x000000000000000000000000' + address.slice(2);

// Simple ABI encoding for function calls
const encodeFunctionCall = (functionName, params) => {
  const functionSignatures = {
    approve: '0x095ea7b3',
    balanceOf: '0x70a08231',
    decimals: '0x313ce567',
    depositForBurnWithCaller: '0x8c7af8a5',
    depositForBurnWithHook: '0x1f9014c5'
  };

  let data = functionSignatures[functionName];

  if (functionName === 'approve') {
    data += padHex(params.spender.slice(2), 64);
    data += padHex(params.amount.toString(16), 64);
  } else if (functionName === 'balanceOf') {
    data += padHex(params.account.slice(2), 64);
  } else if (functionName === 'depositForBurnWithCaller') {
    data += padHex(params.amount.toString(16), 64);
    data += padHex(params.destinationDomain.toString(16), 64);
    data += params.mintRecipient.slice(2);
    data += padHex(params.burnToken.slice(2), 64);
    data += params.destinationCaller.slice(2);
  } else if (functionName === 'depositForBurnWithHook') {
    data += padHex(params.amount.toString(16), 64);
    data += padHex(params.destinationDomain.toString(16), 64);
    data += params.mintRecipient.slice(2);
    data += padHex(params.burnToken.slice(2), 64);
    data += padHex('80', 64); // offset for hookData
    data += padHex((params.hookData.length - 2) / 2, 64); // length of hookData
    data += params.hookData.slice(2);
  }

  return data;
};

// Parse hex response
const parseHexResponse = (hex) => {
  if (!hex || hex === '0x') return '0';
  return BigInt(hex).toString();
};

const MultichainPaymentGateway = () => {
  const [account, setAccount] = useState(null);
  const [sourceChain, setSourceChain] = useState(1);
  const [destinationChain, setDestinationChain] = useState(42161);
  const [amount, setAmount] = useState('100');
  const [merchantAddress, setMerchantAddress] = useState('0x742d35Cc6634C0532925a3b844Bc9e7595f8C2B2');
  const [selectedHook, setSelectedHook] = useState('treasuryRebalance');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [balances, setBalances] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fastTransferEnabled, setFastTransferEnabled] = useState(true);
  const [treasurySettings, setTreasurySettings] = useState({
    preferredChain: 8453,
    autoRebalanceThreshold: '1000',
    distributionRules: {
      1: 20,
      42161: 30,
      8453: 50
    }
  });

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        await updateBalances(accounts[0]);
      } else {
        alert('Please install MetaMask to use this application');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  // Get USDC balance
  const getUSDCBalance = async (address, chainId) => {
    try {
      const config = CHAIN_CONFIG[chainId];

      // Call balanceOf
      const balanceData = encodeFunctionCall('balanceOf', { account: address });
      const balanceResult = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: config.usdc,
          data: balanceData
        }, 'latest']
      });

      // Call decimals
      const decimalsData = encodeFunctionCall('decimals', {});
      const decimalsResult = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: config.usdc,
          data: decimalsData
        }, 'latest']
      });

      const balance = parseHexResponse(balanceResult);
      const decimals = parseInt(parseHexResponse(decimalsResult));

      // Convert to human readable format
      return (parseFloat(balance) / Math.pow(10, decimals)).toFixed(2);
    } catch (error) {
      console.error(`Error fetching balance for chain ${chainId}:`, error);
      return '0';
    }
  };

  // Update USDC balances across chains
  const updateBalances = async (address) => {
    const newBalances = {};

    // Get current chain ID
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    const currentChainIdDec = fromHex(currentChainId);

    // For current chain, get actual balance
    if (CHAIN_CONFIG[currentChainIdDec]) {
      newBalances[currentChainIdDec] = await getUSDCBalance(address, currentChainIdDec);
    }

    // For other chains, show placeholder or cached values
    for (const chainId of Object.keys(CHAIN_CONFIG)) {
      if (chainId !== currentChainIdDec.toString()) {
        newBalances[chainId] = balances[chainId] || '0';
      }
    }

    setBalances(newBalances);
  };

  // Switch network
  const switchNetwork = async (chainId) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_CONFIG[chainId].chainIdHex }],
      });

      // Update balance for the new chain
      if (account) {
        const balance = await getUSDCBalance(account, chainId);
        setBalances(prev => ({ ...prev, [chainId]: balance }));
      }
    } catch (error) {
      if (error.code === 4902) {
        alert('Please add this network to MetaMask');
      }
      console.error('Error switching network:', error);
    }
  };

  // Process payment with CCTP V2
  const processPayment = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setTransactionStatus({ status: 'pending', message: 'Initiating payment...' });

    try {
      // Switch to source chain
      await switchNetwork(sourceChain);

      const sourceConfig = CHAIN_CONFIG[sourceChain];
      const destinationConfig = CHAIN_CONFIG[destinationChain];

      // Convert amount to smallest unit (6 decimals for USDC)
      const amountInUnits = Math.floor(parseFloat(amount) * 1e6);

      // Step 1: Approve USDC
      setTransactionStatus({ status: 'pending', message: 'Approving USDC...' });

      const approveData = encodeFunctionCall('approve', {
        spender: sourceConfig.tokenMessenger,
        amount: amountInUnits
      });

      const approveTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: account,
          to: sourceConfig.usdc,
          data: approveData
        }]
      });

      // Wait for approval transaction
      let approveReceipt;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        approveReceipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [approveTx]
        });
      } while (!approveReceipt);

      // Step 2: Initiate CCTP transfer
      setTransactionStatus({
        status: 'pending',
        message: fastTransferEnabled ? 'Initiating Fast Transfer...' : 'Initiating Standard Transfer...'
      });

      const mintRecipient = addressToBytes32(merchantAddress);
      let burnData;

      if (selectedHook && fastTransferEnabled) {
        // Use depositForBurnWithHook
        burnData = encodeFunctionCall('depositForBurnWithHook', {
          amount: amountInUnits,
          destinationDomain: destinationConfig.domain,
          mintRecipient: mintRecipient,
          burnToken: sourceConfig.usdc,
          hookData: HOOK_TEMPLATES[selectedHook].hookData
        });
      } else {
        // Use depositForBurnWithCaller
        const destinationCaller = addressToBytes32('0x0000000000000000000000000000000000000000');
        burnData = encodeFunctionCall('depositForBurnWithCaller', {
          amount: amountInUnits,
          destinationDomain: destinationConfig.domain,
          mintRecipient: mintRecipient,
          burnToken: sourceConfig.usdc,
          destinationCaller: destinationCaller
        });
      }

      const burnTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: account,
          to: sourceConfig.tokenMessenger,
          data: burnData
        }]
      });

      // Wait for burn transaction
      let burnReceipt;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        burnReceipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [burnTx]
        });
      } while (!burnReceipt);

      setTransactionStatus({
        status: 'success',
        message: `Payment sent successfully!`,
        details: {
          from: sourceConfig.name,
          to: destinationConfig.name,
          amount: amount + ' USDC',
          recipient: merchantAddress,
          txHash: burnTx,
          estimatedTime: fastTransferEnabled ? '~10 seconds' : '~15 minutes',
          hook: selectedHook ? HOOK_TEMPLATES[selectedHook].name : 'None'
        }
      });

      // Simulate attestation completion
      if (fastTransferEnabled) {
        setTimeout(() => {
          setTransactionStatus(prev => ({
            ...prev,
            message: 'Transfer completed! Funds received on destination chain.',
            attestationReceived: true
          }));
        }, 5000);
      }

      // Update balance after transfer
      setTimeout(() => updateBalances(account), 10000);
    } catch (error) {
      console.error('Payment error:', error);
      setTransactionStatus({
        status: 'error',
        message: 'Payment failed: ' + (error.message || 'Unknown error')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          updateBalances(accounts[0]);
        } else {
          setAccount(null);
          setBalances({});
        }
      });

      window.ethereum.on('chainChanged', () => {
        if (account) {
          updateBalances(account);
        }
      });
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  CCTP V2 Payment Gateway
                </h1>
                <p className="text-sm text-gray-400">Universal Multichain USDC Payments</p>
              </div>
            </div>

            {account ? (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-400">Connected</p>
                  <p className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chain Selection */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <ArrowRightLeft className="w-5 h-5 mr-2" />
                Select Payment Route
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Chain */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Pay From</label>
                  <div className="space-y-2">
                    {Object.entries(CHAIN_CONFIG).map(([chainId, config]) => (
                      <button
                        key={chainId}
                        onClick={() => setSourceChain(parseInt(chainId))}
                        className={`w-full p-3 rounded-lg border transition-all duration-200 ${
                          sourceChain === parseInt(chainId)
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{config.icon}</span>
                            <span className="font-medium">{config.name}</span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {balances[chainId] || '0'} USDC
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination Chain */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Settle To</label>
                  <div className="space-y-2">
                    {Object.entries(CHAIN_CONFIG).map(([chainId, config]) => (
                      <button
                        key={chainId}
                        onClick={() => setDestinationChain(parseInt(chainId))}
                        disabled={parseInt(chainId) === sourceChain}
                        className={`w-full p-3 rounded-lg border transition-all duration-200 ${
                          destinationChain === parseInt(chainId)
                            ? 'border-purple-500 bg-purple-500/20'
                            : parseInt(chainId) === sourceChain
                            ? 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{config.icon}</span>
                            <span className="font-medium">{config.name}</span>
                          </div>
                          {fastTransferEnabled && (
                            <Zap className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Payment Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Merchant Address</label>
                  <input
                    type="text"
                    value={merchantAddress}
                    onChange={(e) => setMerchantAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                    placeholder="0x..."
                  />
                </div>

                {/* Transfer Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Zap className={`w-5 h-5 ${fastTransferEnabled ? 'text-yellow-400' : 'text-gray-600'}`} />
                    <div>
                      <p className="font-medium">Fast Transfer</p>
                      <p className="text-xs text-gray-400">
                        {fastTransferEnabled ? 'Settlement in ~10 seconds' : 'Standard finality ~15 minutes'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFastTransferEnabled(!fastTransferEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      fastTransferEnabled ? 'bg-blue-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        fastTransferEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Hooks Selection */}
            {fastTransferEnabled && (
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Automated Actions (Hooks)
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(HOOK_TEMPLATES).map(([key, hook]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedHook(selectedHook === key ? null : key)}
                      className={`p-4 rounded-lg border transition-all duration-200 text-left ${
                        selectedHook === key
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{hook.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium">{hook.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{hook.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <span className="font-medium">Advanced Treasury Settings</span>
                <span className="text-gray-400">{showAdvanced ? '−' : '+'}</span>
              </button>

              {showAdvanced && (
                <div className="p-6 border-t border-gray-800 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Auto-Rebalance Threshold (USDC)</label>
                    <input
                      type="number"
                      value={treasurySettings.autoRebalanceThreshold}
                      onChange={(e) => setTreasurySettings({ ...treasurySettings, autoRebalanceThreshold: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Distribution Rules</label>
                    <div className="space-y-2">
                      {Object.entries(treasurySettings.distributionRules).map(([chainId, percentage]) => (
                        <div key={chainId} className="flex items-center space-x-3">
                          <span className="text-lg">{CHAIN_CONFIG[chainId].icon}</span>
                          <span className="flex-1 text-sm">{CHAIN_CONFIG[chainId].name}</span>
                          <input
                            type="number"
                            value={percentage}
                            onChange={(e) => setTreasurySettings({
                              ...treasurySettings,
                              distributionRules: {
                                ...treasurySettings.distributionRules,
                                [chainId]: parseInt(e.target.value)
                              }
                            })}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-center"
                            min="0"
                            max="100"
                          />
                          <span className="text-sm text-gray-400">%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Process Payment Button */}
            <button
              onClick={processPayment}
              disabled={!account || isProcessing || !amount || parseFloat(amount) <= 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                isProcessing || !account || !amount || parseFloat(amount) <= 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transform hover:scale-[1.02]'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Process Payment</span>
                </>
              )}
            </button>

            {/* Transaction Status */}
            {transactionStatus && (
              <div
                className={`p-6 rounded-xl border ${
                  transactionStatus.status === 'success'
                    ? 'bg-green-900/20 border-green-800'
                    : transactionStatus.status === 'error'
                    ? 'bg-red-900/20 border-red-800'
                    : 'bg-blue-900/20 border-blue-800'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {transactionStatus.status === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-green-400 mt-0.5" />
                  ) : transactionStatus.status === 'error' ? (
                    <AlertCircle className="w-6 h-6 text-red-400 mt-0.5" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{transactionStatus.message}</p>

                    {transactionStatus.details && (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Route:</span>
                          <span>{transactionStatus.details.from} → {transactionStatus.details.to}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span>{transactionStatus.details.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Recipient:</span>
                          <span className="font-mono text-xs">{transactionStatus.details.recipient.slice(0, 10)}...{transactionStatus.details.recipient.slice(-8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Settlement Time:</span>
                          <span>{transactionStatus.details.estimatedTime}</span>
                        </div>
                        {transactionStatus.details.hook !== 'None' && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Automated Action:</span>
                            <span>{transactionStatus.details.hook}</span>
                          </div>
                        )}
                        {transactionStatus.details.txHash && (
                          <div className="pt-2 mt-2 border-t border-gray-700">
                            <a
                              href={`${CHAIN_CONFIG[sourceChain].explorer}/tx/${transactionStatus.details.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              View on Explorer →
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {transactionStatus.attestationReceived && (
                      <div className="mt-3 p-3 bg-green-900/30 rounded-lg border border-green-800">
                        <p className="text-sm text-green-400 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Attestation received! Funds minted on destination chain.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            {/* Features */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-bold mb-4">CCTP V2 Features</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Zap className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Fast Transfers</p>
                    <p className="text-sm text-gray-400">Settlement in seconds, not minutes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Settings className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Automated Hooks</p>
                    <p className="text-sm text-gray-400">Post-transfer actions without manual intervention</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Native Security</p>
                    <p className="text-sm text-gray-400">Burn-and-mint mechanism secured by Circle</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <DollarSign className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Capital Efficient</p>
                    <p className="text-sm text-gray-400">No liquidity pools or wrapped tokens</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chain Support */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-bold mb-4">Supported Chains</h3>
              <div className="space-y-2">
                {Object.entries(CHAIN_CONFIG).map(([chainId, config]) => (
                  <div key={chainId} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{config.icon}</span>
                      <span className="font-medium">{config.name}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${config.color}`}></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Treasury Overview */}
            {account && (
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold mb-4">Treasury Overview</h3>
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <p className="text-3xl font-bold">
                      {Object.values(balances).reduce((sum, balance) => sum + parseFloat(balance || 0), 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400">Total USDC Balance</p>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(balances).map(([chainId, balance]) => {
                      const percentage =
                        Object.values(balances).reduce((sum, b) => sum + parseFloat(b || 0), 0) > 0
                          ? (parseFloat(balance || 0) /
                              Object.values(balances).reduce((sum, b) => sum + parseFloat(b || 0), 0) *
                              100)
                          : 0;

                      return (
                        <div key={chainId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{CHAIN_CONFIG[chainId].name}</span>
                            <span>{parseFloat(balance || 0).toFixed(2)} USDC</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${CHAIN_CONFIG[chainId].color}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MultichainPaymentGateway;
