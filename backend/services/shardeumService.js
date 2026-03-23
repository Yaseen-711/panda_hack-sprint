const { ethers } = require("ethers");

// Using Shardeum Sphinx 1.X testnet RPC
const provider = new ethers.JsonRpcProvider("https://sphinx.shardeum.org/");

async function getRealBalance(address) {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (err) {
    console.error("Error fetching real balance:", err);
    return null;
  }
}

module.exports = { getRealBalance };
