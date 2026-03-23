// Simulates a Shardeum blockchain transaction
async function simulateTransaction(action, amount, token, to) {
    // Artificial delay to simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (action === 'balance') {
        return "completed";
    }

    // Usually this would return a txHash and wait for confirmation.
    // Here we just return 'completed' to match the required API contract 'txStatus'.
    return "completed";
}

module.exports = {
    simulateTransaction
};
