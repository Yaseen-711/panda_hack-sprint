# Shardeum Smart Intent Wallet

A next-generation crypto wallet built for the Shardeum blockchain that translates natural language intents into executable transactions using the Gemini API.

## Features
- **Smart Intent Execution**: Instead of clicking around, type "Send 0.05 SHM to 0xabc" and the wallet does the rest.
- **Transaction Simulation**: Fully simulates network latency and validates tx statuses.
- **Clean UI**: Dark theme, minimal design, responsive interface.
- **Transaction History**: Keeps track of all processed intents and their outcomes.

## Prerequisites
- Node.js (v18+ recommended)
- A Gemini API Key from Google AI Studio.

## Setup Instructions

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies (should already be done, but just in case):
   ```bash
   npm install
   ```
3. Create a `.env` file and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   *(Note: The system has a built-in fallback parser if the API key is not provided, allowing it to still work with basic commands like "Send X to Y" or "Check balance".)*
4. Start the server:
   ```bash
   npm start
   ```

### 2. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 3. Usage
- Open your browser to the URL provided by Vite (usually `http://localhost:5173`).
- Enter natural language commands in the Smart Intent box.
- Example: *"Send 10 SHM to 0x123..."*

## Tech Stack
- Frontend: React + Vite + Vanilla CSS
- Backend: Node.js + Express
- AI Integration: @google/generative-ai
