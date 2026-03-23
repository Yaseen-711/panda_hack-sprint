import React, { useState, useEffect } from 'react';
import { Send, History, Loader2, Zap, LogIn, User, Wallet, Copy } from 'lucide-react';
import { loginUser, sendIntent, fetchHistory, fetchRealBalance, addContact } from './api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [realBalance, setRealBalance] = useState(null);
  
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  const [unknownContactMsg, setUnknownContactMsg] = useState(null);
  const [newContactAddress, setNewContactAddress] = useState('');
  const [pendingContactName, setPendingContactName] = useState('');

  const examples = [
    "Send 10 INR to friend",
    "Transfer 0.1 SHM to anish",
    "Check my balance"
  ];

  const loadHistory = async (username) => {
    try {
      const res = await fetchHistory(username);
      if (res.success) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginInput.trim() || !passwordInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await loginUser(loginInput, passwordInput);
      if (res.success) {
        setCurrentUser({ ...res.data, password: passwordInput });
        loadHistory(res.data.username);

        // Fetch Real Balance
        try {
          const realBalRes = await fetchRealBalance(res.data.address);
          if (realBalRes.success) {
            setRealBalance(realBalRes.data.balance);
          }
        } catch (e) {
          console.error("Could not fetch real balance", e);
        }

        setLoginInput('');
        setPasswordInput('');
      } else {
        setError(res.error || "Login failed");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Network error logging in");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setHistory([]);
    setResult(null);
    setRealBalance(null);
    setUnknownContactMsg(null);
  };

  const handleSaveContact = async (e) => {
    if (e) e.preventDefault();
    if (!newContactAddress.trim() || !pendingContactName) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await addContact(currentUser.username, pendingContactName, newContactAddress);
      if (res.success) {
        setUnknownContactMsg(null);
        setNewContactAddress('');
        // Resubmit the intent!
        handleSubmit({ preventDefault: () => {} });
      } else {
        setError(res.error || "Failed to save contact");
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Error saving contact");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!intent.trim() || !currentUser) return;

    setLoading(true);
    setError('');
    setResult(null);
    setUnknownContactMsg(null);

    try {
      // 1. Dry Run to get parsed intent and confirmation summary
      const dryRes = await sendIntent(intent, currentUser.username, currentUser.password, true);
      if (!dryRes.success) {
        if (dryRes.error === 'UNKNOWN_CONTACT') {
          setUnknownContactMsg(dryRes.message);
          setPendingContactName(dryRes.contactName || '');
          setLoading(false);
          return;
        }
        setError(dryRes.error || "Failed to process intent");
        setLoading(false);
        return;
      }

      const parsed = dryRes.data;

      // 2. Ask for confirmation if it's a transfer
      if (parsed.action === 'transfer') {
        const confirmed = window.confirm(`Confirm Transaction:\n\n${parsed.summary}`);
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }

      // 3. Execute actual transaction
      const res = await sendIntent(intent, currentUser.username, currentUser.password, false);
      if (res.success) {
        setResult(res.data);
        
        // Update local balance
        if (res.data.newBalance !== undefined) {
          setCurrentUser(prev => ({ ...prev, balance: res.data.newBalance }));
        }

        loadHistory(currentUser.username);
        setIntent('');
      } else {
        setError(res.error || "Failed to process intent");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Network error. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div>
        <header>
          <h1>Smart Intent Wallet</h1>
          <p className="subtitle">Execute transactions on Shardeum using natural language.</p>
        </header>
        <div className="card">
          <form onSubmit={handleLogin} className="input-group">
            <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={18} color="#3b82f6" /> Enter Details to Login
            </label>
            <input
              type="text"
              className="input-box"
              placeholder="e.g. anish"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              disabled={loading}
            />
            <input
              type="password"
              className="input-box"
              placeholder="Password (e.g. 1234)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="submit-btn" disabled={loading || !loginInput.trim() || !passwordInput.trim()}>
              {loading ? <Loader2 className="loader" size={20} /> : <Zap size={20} />}
              {loading ? 'Logging in...' : 'Connect Wallet'}
            </button>
          </form>
          {error && <div className="error-box">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1>Smart Intent Wallet</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>Connected to Shardeum</p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      {/* User Info Card */}
      <div className="card user-card">
        <div className="user-detail">
          <User size={20} color="#94a3b8" />
          <span className="username">@{currentUser.username}</span>
        </div>
        <div className="user-detail balance-box">
          <Wallet size={20} color="#10b981" />
          <span className="balance">{currentUser.balance.toFixed(2)} SHM <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}></span></span>
        </div>
        
        {realBalance !== null && (
          <div className="user-detail balance-box" style={{ marginTop: '-0.5rem', fontSize: '1.2rem' }}>
            <Wallet size={16} color="#3b82f6" />
            <span className="balance" style={{ color: '#3b82f6' }}>{Number(realBalance).toFixed(4)} SHM <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>(Real)</span></span>
          </div>
        )}

        <div className="user-address">
          {currentUser.address}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
          Blockchain data fetched from Shardeum testnet
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="input-group">
          <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#3b82f6" /> What do you want to do?
          </label>
          <input
            type="text"
            className="input-box"
            placeholder={examples[Math.floor(Math.random() * examples.length)]}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="submit-btn" disabled={loading || !intent.trim()}>
            {loading && !unknownContactMsg ? <Loader2 className="loader" size={20} /> : <Send size={20} />}
            {loading && !unknownContactMsg ? 'Processing Intent...' : 'Execute Intent'}
          </button>
        </form>

        {unknownContactMsg && (
          <div className="card" style={{ marginTop: '1rem', border: '1px solid #eab308', backgroundColor: 'rgba(234, 179, 8, 0.05)' }}>
            <h3 style={{ color: '#eab308', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚠️ Unknown Contact</h3>
            <p style={{ color: 'var(--text-color)', marginBottom: '1rem' }}>{unknownContactMsg}</p>
            <form onSubmit={handleSaveContact} className="input-group">
              <input
                type="text"
                className="input-box"
                placeholder="Enter 42-character 0x address..."
                value={newContactAddress}
                onChange={(e) => setNewContactAddress(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit"
                className="submit-btn" 
                disabled={loading || !newContactAddress.trim()}
                style={{ backgroundColor: '#eab308', color: '#000' }}
              >
                {loading ? <Loader2 className="loader" size={20} /> : 'Save & Retry'}
              </button>
            </form>
          </div>
        )}

        {error && <div className="error-box" style={{marginTop:'1rem'}}>{error}</div>}

        {result && (
          <div className="result-box">
            <div className="result-header">
              <Zap size={24} />
              Transaction Executed
            </div>

            <div className="result-detail" style={{ gridColumn: '1 / -1', fontSize: '1.05rem', fontWeight: 500, margin: '0.5rem 0', color: '#fff' }}>
              {result.summary}
            </div>
            
            <div className="result-detail">
              <span className="result-label">Action:</span>
              <span className="result-value" style={{ textTransform: 'capitalize' }}>{result.action}</span>
            </div>
            
            {result.txHash && (
              <div className="result-detail">
                <span className="result-label">Tx Hash:</span>
                <span className="result-value" style={{ fontSize: '0.8rem' }}>{result.txHash}</span>
              </div>
            )}

            {result.amountSHM && (
              <div className="result-detail">
                <span className="result-label">Amount:</span>
                <span className="result-value">
                  {result.amountSHM} SHM {result.amountINR && `(~${result.amountINR} INR)`}
                </span>
              </div>
            )}
            
            {result.amountINR && (
              <div className="result-detail" style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: '#3b82f6', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                Auto-converted using fixed rate (1 SHM = 10 INR)
              </div>
            )}
            
            {result.to && (
              <div className="result-detail">
                <span className="result-label">Recipient:</span>
                <span className="result-value">{result.to}</span>
              </div>
            )}
            
            
            <div className="result-detail">
              <span className="result-label">Status:</span>
              <span className="result-value" style={{ color: '#10b981' }}>{result.txStatus}</span>
            </div>

            {result.action === 'transfer' && (
              <div className="result-detail" style={{ gridColumn: '1 / -1', margin: '0.5rem 0' }}>
                {result.isNewContact 
                  ? <span style={{ backgroundColor: '#eab308', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>New Contact ⚠️</span>
                  : <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Trusted Contact ✅</span>
                }
              </div>
            )}

            <div className="explanation">
              <strong>Details:</strong> {result.explanation}
            </div>
          </div>
        )}
      </div>

      <div className="card history-section">
        <h2><History size={20} /> Transaction History</h2>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No intents processed yet.</p>
        ) : (
          <div className="history-list">
            {history.map((tx) => (
              <div key={tx.id} className="history-item">
                <div className="history-time">{new Date(tx.timestamp).toLocaleString()}</div>
                <div className="history-summary">{tx.summary}</div>
                {tx.txHash && <div className="history-intent">Hash: {tx.txHash}</div>}
                {tx.amountSHM && <div className="history-intent">Value: {tx.amountSHM} SHM {tx.amountINR && `(~${tx.amountINR} INR)`}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
