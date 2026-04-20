import api from './api';
import { getToken } from '@/utils/auth';

export interface LeadAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface LeadAssistantConversation {
  conversationId: string | null;
  leadContext: {
    id: string;
    name: string;
    phone?: string | null;
    service?: string | null;
    source?: string | null;
    budget?: string | null;
    status?: string | null;
    notes?: string | null;
    aiProfileSummary?: string | null;
    aiProfileInsights?: unknown;
  };
  messages: LeadAssistantMessage[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const extractErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload?.message) return payload.message as string;
  } catch {}

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {}

  return 'فشل الاتصال بمساعد العميل';
};

export const aiService = {
  getLeadConversation: async (leadId: string): Promise<LeadAssistantConversation> => {
    const res = await api.get(`/ai/leads/${leadId}/conversation`);
    return res.data.data;
  },

  streamLeadConversation: async ({
    leadId,
    message,
    model,
    onText,
  }: {
    leadId: string;
    message: string;
    model?: string;
    onText?: (text: string) => void;
  }) => {
    const token = getToken();
    const response = await fetch(`${API_URL}/ai/leads/${encodeURIComponent(leadId)}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        ...(model ? { model } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    if (!response.body) {
      throw new Error('لم تصل استجابة من مساعد العميل');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let assistantReply = '';
    let buffer = '';

    const processBlock = (block: string) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'));

      for (const line of lines) {
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error && parsed.message) {
            throw new Error(parsed.message);
          }
          if (parsed.text) {
            assistantReply += parsed.text;
            onText?.(assistantReply);
          }
        } catch (err) {
          if (err instanceof Error) {
            throw err;
          }
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        processBlock(block);
        separatorIndex = buffer.indexOf('\n\n');
      }

      if (done) break;
    }

    if (buffer.trim()) {
      processBlock(buffer);
    }

    return assistantReply;
  },
};
