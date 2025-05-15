import axios from 'axios';
 
export async function sendLlmChatMessage(message) {
  const res = await axios.post('/api/llm-chat/message', { message });
  return res.data;
} 