const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function localParser(input) {
    const data = {
        action: null,
        amount: null,
        currency: "SHM",
        recipient: null,
        summary: "",
        explanation: "Using fast local parsing rules for efficiency."
    };

    if (input.includes('balance') || input.includes('check')) {
        data.action = 'balance';
        data.summary = "Checking Shardeum balance";
        return data;
    }

    if (input.includes('send') || input.includes('transfer') || input.includes('pay')) {
        data.action = 'transfer';
        
        const amountMatch = input.match(/\d+(\.\d+)?/);
        if (amountMatch) {
            data.amount = amountMatch[0];
        }

        if (input.includes('inr')) {
            data.currency = 'INR';
        }

        const toMatch = input.match(/\bto\s+([@\w0-9_x]+)/i);
        if (toMatch && toMatch[1]) {
            data.recipient = toMatch[1];
        }

        if (data.amount && data.recipient) {
            data.summary = `Sending ${data.amount} ${data.currency} to ${data.recipient}`;
            return data;
        }
    }

    return null;
}

function getHardFallback() {
    console.log("Fallback triggered");
    return {
        success: true,
        data: {
            action: "send",
            amount: 0,
            currency: "SHM",
            token: "SHM",
            to: "unknown",
            summary: "Safe fallback engaged.",
            explanation: "Using fallback parsing"
        }
    };
}

async function parseIntent(userInput) {
    const trimmedInput = userInput.trim();
    const lowerInput = trimmedInput.toLowerCase();

    // 1. SMART ROUTING -> LOCAL PARSER
    const localData = localParser(lowerInput);
    if (localData) {
        console.log("Used local parser");
        return {
            success: true,
            data: {
                action: localData.action,
                amount: localData.amount,
                currency: localData.currency,
                to: localData.recipient,
                summary: localData.summary,
                explanation: localData.explanation
            }
        };
    }

    if (!process.env.GEMINI_API_KEY) {
        console.warn("No GEMINI_API_KEY found.");
        return getHardFallback();
    }

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { temperature: 0.1 }
        });

        const prompt = `
Extract the intent and return ONLY STRICT JSON matching this schema exactly. No markdown.
User Input: "${trimmedInput}"
{
  "action": "transfer | swap | balance",
  "amount": "string representing the amount",
  "currency": "SHM or INR",
  "to": "destination address or contact name",
  "summary": "Short summary",
  "explanation": "Short friendly AI explanation"
}
`;
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const data = JSON.parse(responseText);
        console.log("Used Gemini API");

        return {
            success: true,
            data: {
                action: data.action || "unknown",
                amount: data.amount || null,
                currency: data.currency || data.token || "SHM",
                to: data.to || data.recipient || null,
                summary: data.summary || `Simulated ${data.action || 'action'}`,
                explanation: data.explanation || "Interpreted from your natural language via AI."
            }
        };

    } catch (error) {
        console.error("Gemini API Error:", error.message);
        return getHardFallback();
    }
}

module.exports = {
    parseIntent
};
