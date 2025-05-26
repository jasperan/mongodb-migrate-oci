import axios from 'axios';
 
export async function sendLlmChatMessage(message) {
  const res = await axios.post('http://localhost:8000/rag', { question: message });
  return res.data;
} 