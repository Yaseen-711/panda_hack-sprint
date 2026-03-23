require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { parseIntent } = require('./services/aiService');
const { simulateTransaction } = require('./services/blockchainService');
const { getRealBalance } = require('./services/shardeumService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'data.json');

function loadData() {
    if (!fs.existsSync(dataPath)) {
        if (!fs.existsSync(path.dirname(dataPath))) fs.mkdirSync(path.dirname(dataPath));
        fs.writeFileSync(dataPath, JSON.stringify({ users: [], transactions: [] }));
    }
    return JSON.parse(fs.readFileSync(dataPath));
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function generateTxHash() {
    return "0x" + Math.random().toString(16).substring(2, 15);
}

// POST /api/login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: "Username and password required" });

    const lowerUsername = username.toLowerCase();
    const data = loadData();
    let user = data.users.find(u => u.username === lowerUsername);

    if (!user) {
        user = {
            username: lowerUsername,
            password: password,
            balance: 1.0,
            address: ethers.Wallet.createRandom().address,
            contacts: []
        };
        data.users.push(user);
        saveData(data);
    } else if (user.password !== password) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const { password: _, ...userData } = user;
    res.json({
        success: true,
        data: userData
    });
});

// POST /api/add-contact
app.post('/api/add-contact', (req, res) => {
    const { username, contactName, address } = req.body;
    if (!username || !contactName || !address) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (!ethers.isAddress(address)) {
        return res.status(400).json({ success: false, error: "Invalid Ethereum address" });
    }

    const lowerUsername = username.toLowerCase();
    const data = loadData();
    const userIndex = data.users.findIndex(u => u.username === lowerUsername);
    if (userIndex === -1) return res.status(404).json({ success: false, error: "User not found" });

    // Ensure contacts array exists
    if (!data.users[userIndex].contacts) {
        data.users[userIndex].contacts = [];
    }

    // Add or update
    const existingIndex = data.users[userIndex].contacts.findIndex(c => c.name.toLowerCase() === contactName.toLowerCase());
    if (existingIndex !== -1) {
        data.users[userIndex].contacts[existingIndex].address = address;
    } else {
        data.users[userIndex].contacts.push({ name: contactName, address });
    }

    saveData(data);

    res.json({
        success: true,
        data: "Contact saved"
    });
});

// POST /api/intent
app.post('/api/intent', async (req, res) => {
    try {
        const { userInput, username, password, dryRun } = req.body;
        if (!userInput || !username || !password) {
            return res.status(400).json({ success: false, data: null, error: "userInput, username, and password are required" });
        }

        const data = loadData();
        const senderIndex = data.users.findIndex(u => u.username === username.toLowerCase());
        if (senderIndex === -1 || data.users[senderIndex].password !== password) {
            return res.status(401).json({ success: false, error: "Invalid credentials. Please log in again." });
        }

        // 1. Parse intent using Gemini AI
        const parsedIntent = await parseIntent(userInput);
        
        if (!parsedIntent.success) {
            return res.status(500).json({ success: false, data: null, error: parsedIntent.error });
        }
        
        const { action, amount, currency, to } = parsedIntent.data;
        let { summary, explanation } = parsedIntent.data;

        // Validation for transfer
        let receiverName = to;
        let txHash = null;
        let amountSHM = 0;
        let amountINR = null;
        let isNewContact = false;

        if (action === 'balance') {
            const balSHM = data.users[senderIndex].balance;
            const balINR = balSHM * 10;
            summary = `Your current balance is ${balSHM} SHM (~${balINR} INR)`;
        } else if (action === 'transfer') {
            const rawAmount = parseFloat(amount);
            if (isNaN(rawAmount) || rawAmount <= 0) {
                return res.status(400).json({ success: false, error: "Invalid amount parsed." });
            }

            if (currency === 'INR') {
                amountINR = rawAmount;
                amountSHM = rawAmount / 10;
            } else {
                amountSHM = rawAmount;
                amountINR = rawAmount * 10;
            }

            if (data.users[senderIndex].balance < amountSHM) {
                return res.status(400).json({ success: false, error: "Insufficient balance." });
            }

            let receiverAddress = null;

            if (ethers.isAddress(receiverName)) {
                receiverAddress = receiverName;
                const contacts = data.users[senderIndex].contacts || [];
                isNewContact = !contacts.some(c => c.address.toLowerCase() === receiverAddress.toLowerCase());
            } else {
                const contacts = data.users[senderIndex].contacts || [];
                const contact = contacts.find(c => c.name.toLowerCase() === receiverName?.toLowerCase());
                
                if (contact) {
                    receiverAddress = contact.address;
                } else {
                    // Check if they are an existing user in the database
                    const existingUser = data.users.find(u => u.username.toLowerCase() === receiverName?.toLowerCase());
                    if (existingUser) {
                        receiverAddress = existingUser.address;
                        
                        // Auto-add to contacts for future convenience
                        data.users[senderIndex].contacts.push({ name: existingUser.username, address: receiverAddress });
                        isNewContact = true;
                    } else {
                        return res.status(400).json({
                            success: false,
                            error: "UNKNOWN_CONTACT",
                            contactName: receiverName,
                            message: `First time sending to ${receiverName}. Please provide their wallet address.`
                        });
                    }
                }
            }

            if (isNewContact) {
                explanation = "This is a new recipient. Please verify the wallet address before sending funds.";
            } else {
                explanation = "Recipient recognized. This transaction is considered safe based on previous interactions.";
            }

            if (dryRun) {
                return res.json({
                    success: true,
                    data: {
                        action,
                        amountSHM,
                        amountINR,
                        currency,
                        to: receiverName,
                        summary: `You are sending ${amountSHM} SHM ${amountINR ? `(which is ${amountINR} INR) ` : ''}to ${receiverName} (${receiverAddress})`,
                        explanation,
                        isNewContact
                    }
                });
            }

            // Execute local transfer if user exists in db
            let receiverIndex = data.users.findIndex(u => u.address.toLowerCase() === receiverAddress.toLowerCase());
            data.users[senderIndex].balance -= amountSHM;
            if (receiverIndex !== -1) {
                data.users[receiverIndex].balance += amountSHM;
            }
            txHash = generateTxHash();
        }

        if (dryRun) {
            return res.json({
                success: true,
                data: {
                    action,
                    amountSHM,
                    amountINR,
                    currency,
                    to: receiverName,
                    summary
                }
            });
        }

        // 2. Simulate Blockchain Execution
        const txStatus = await simulateTransaction(action, amountSHM, currency, receiverName);

        const responseData = {
            action,
            amountSHM: amountSHM || null,
            amountINR: amountINR || null,
            currency,
            to: receiverName,
            summary,
            txStatus,
            explanation,
            txHash,
            isNewContact
        };

        // Save to history
        const historyRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            from: data.users[senderIndex].username,
            to: receiverName || null,
            amountSHM: amountSHM || null,
            amountINR: amountINR || null,
            currency: currency || 'SHM',
            txHash: txHash,
            status: txStatus,
            userInput,
            action,
            summary,
            explanation
        };
        data.transactions.unshift(historyRecord); // Add to beginning
        saveData(data);

        // Include updated balance in response
        responseData.newBalance = data.users[senderIndex].balance;

        res.json({
            success: true,
            data: responseData,
            error: null
        });

    } catch (error) {
        console.error("Intent Processing Error:", error);
        res.status(500).json({
            success: false,
            data: null,
            error: "Internal server error processing intent."
        });
    }
});

// GET /api/history
app.get('/api/history', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, error: "Username required" });

    const lowerUsername = username.toLowerCase();
    const data = loadData();
    const userTxs = data.transactions.filter(tx => tx.from === lowerUsername || tx.to === lowerUsername);

    res.json({
        success: true,
        data: userTxs,
        error: null
    });
});

// GET /api/shardeum/balance/:address
app.get('/api/shardeum/balance/:address', async (req, res) => {
    try {
        const address = req.params.address;
        const balance = await getRealBalance(address);
        
        if (balance === null) {
            return res.status(500).json({ success: false, error: "Unable to fetch balance" });
        }

        res.json({
            success: true,
            data: {
                address,
                balance
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Unable to fetch balance" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
