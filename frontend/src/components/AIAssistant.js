import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './AIAssistant.css';

const AIAssistant = () => {
  const { getToken, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: "Hey! I'm **Volt** ⚡, your EV Smart Assistant.\n\nI can help you plan trips, calculate range, understand charging connectors, and more. What's on your mind?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const defaultSuggestions = [
    "Plan a trip from Ahmedabad to Mumbai 🗺️",
    "How much range do I have with 60% battery? 🔋",
    "What's CCS2 vs CHAdeMO? ⚡",
    "Best driving tips to save battery 🌿"
  ];

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetch(`${API_URL}/ai/suggestions`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
        .then(r => r.json())
        .then(d => setSuggestions(d.suggestions || defaultSuggestions))
        .catch(() => setSuggestions(defaultSuggestions));
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Reset chat when user logs out or changes
  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setMessages([
        {
          id: 1,
          role: 'assistant',
          content: "Hey! I'm **Volt** ⚡, your EV Smart Assistant.\n\nI can help you plan trips, calculate range, understand charging connectors, and more. What's on your mind?",
          timestamp: new Date()
        }
      ]);
    }
  }, [isAuthenticated]);


  const sendMessage = useCallback(async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    // Build conversation history inline (avoids stale closure)
    const history = messages
      .filter(m => m.id !== 1)
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg = { id: Date.now(), role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ message: userText, history })
      });
      const data = await res.json();
      const reply = data.reply || "⚡ I couldn't process that. Please try again.";

      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
      if (!isOpen) setHasNewMessage(true);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: "⚠️ Network error. Please check your connection and try again.",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, getToken, isOpen, API_URL, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 1, role: 'assistant',
      content: "Chat cleared! I'm **Volt** ⚡, ready to help with your EV journey. What would you like to know?",
      timestamp: new Date()
    }]);
  };

  // Simple markdown-like renderer for bold and newlines
  const renderContent = (content) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part.split('\n').map((line, j, arr) => (
        <React.Fragment key={j}>{line}{j < arr.length - 1 ? <br /> : null}</React.Fragment>
      ))}</span>;
    });
  };

  const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        className={`volt-fab ${isOpen ? 'volt-fab--open' : ''} ${hasNewMessage ? 'volt-fab--pulse' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open Volt AI Assistant"
        title="Volt — AI EV Assistant"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        )}
        {hasNewMessage && <span className="volt-fab__badge" />}
      </button>

      {/* Chat Window */}
      <div className={`volt-chat ${isOpen ? 'volt-chat--open' : ''}`} role="dialog" aria-label="Volt AI Assistant">
        {/* Header */}
        <div className="volt-header">
          <div className="volt-header__avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="volt-header__info">
            <h3>Volt <span className="volt-header__badge">AI</span></h3>
            <span className="volt-header__status">● Online — EV Smart Assistant</span>
          </div>
          <div className="volt-header__actions">
            <button onClick={clearChat} title="Clear chat" className="volt-icon-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
            <button onClick={() => setIsOpen(false)} className="volt-icon-btn" title="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="volt-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`volt-msg volt-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="volt-msg__avatar">⚡</div>
              )}
              <div className="volt-msg__bubble">
                <div className="volt-msg__content">{renderContent(msg.content)}</div>
                <div className="volt-msg__time">{fmtTime(new Date(msg.timestamp))}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="volt-msg volt-msg--assistant">
              <div className="volt-msg__avatar">⚡</div>
              <div className="volt-msg__bubble">
                <div className="volt-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions (shown only when 1 message = initial greeting) */}
        {messages.length === 1 && !loading && (
          <div className="volt-suggestions">
            {(suggestions.length > 0 ? suggestions : defaultSuggestions).slice(0, 4).map((s, i) => (
              <button key={i} className="volt-suggestion-chip" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="volt-input-area">
          <textarea
            ref={inputRef}
            className="volt-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about EV range, trips, charging..."
            rows={1}
            disabled={loading}
          />
          <button
            className="volt-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;
