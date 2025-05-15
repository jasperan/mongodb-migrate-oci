import React, { useState } from 'react';
import { sendLlmChatMessage } from '../../../utils/llmChatApi';

export default function LlmChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((msgs) => [...msgs, { from: 'user', text: input }]);
    setLoading(true);
    try {
      const res = await sendLlmChatMessage(input);
      setMessages((msgs) => [...msgs, { from: 'llm', text: res.response }]);
    } catch (err) {
      setMessages((msgs) => [...msgs, { from: 'llm', text: 'Error: Could not get response.' }]);
    }
    setInput('');
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h3>LLM Chat</h3>
      <div style={{ minHeight: 120, border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.from === 'user' ? 'right' : 'left' }}>
            <b>{msg.from === 'user' ? 'You' : 'LLM'}:</b> {msg.text}
          </div>
        ))}
        {loading && <div>Loading...</div>}
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, marginRight: 8 }}
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>
    </div>
  );
} 