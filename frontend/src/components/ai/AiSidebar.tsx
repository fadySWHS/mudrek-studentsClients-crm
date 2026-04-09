'use client';
import { useEffect, useRef, useState } from 'react';
import { useAi } from '@/context/AiContext';
import { X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getToken } from '@/utils/auth';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export default function AiSidebar() {
  const { isOpen, setIsOpen, leadContext, initialPrompt, setInitialPrompt } = useAi();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'مرحباً! كيف يمكنني مساعدتك اليوم في تحسين مبيعاتك؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Initial Magic Prompts from anywhere in the app
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSubmit(initialPrompt);
      setInitialPrompt(''); // Clear it so it doesn't trigger again
    }
  }, [isOpen, initialPrompt]);

  const handleSubmit = async (textToSubmit: string = input) => {
    if (!textToSubmit.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: textToSubmit.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: newMessages.filter(m => m.role !== 'system'), // exclude system msg if any from history
          leadContext,
          model: 'openai/gpt-4o-mini' // using an efficient fast model
        })
      });

      if (!response.ok) {
        throw new Error('فشل الاتصال بالمساعد الذكي');
      }

      // Handle server-sent events stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let assistantReply = '';
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunkText = decoder.decode(value, { stream: true });
            const lines = chunkText.split('\n').filter(line => line.trim().startsWith('data: '));
            
            for (const line of lines) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  assistantReply += parsed.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1].content = assistantReply;
                    return updated;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }

    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ حدث خطأ: ${e.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden" 
        onClick={() => setIsOpen(false)}
      />
      <div className={cn(
        "fixed top-0 left-0 bottom-0 w-[95%] sm:w-[400px] bg-white border-r border-gray-200 shadow-2xl z-50 flex flex-col transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-surface">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Sales Copilot</h3>
              {leadContext && (
                <p className="text-xs text-primary font-medium">سياق: {leadContext.name}</p>
              )}
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto")}>
              <div className={cn("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center", 
                msg.role === 'user' ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn("p-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed",
                msg.role === 'user' ? "bg-primary text-white rounded-tr-sm" : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%] ml-auto">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl rounded-tl-sm border border-gray-100 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-gray-500">يفكر...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-end gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <textarea
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm max-h-32 min-h-[44px] resize-none py-3 px-3"
              placeholder="اسألني عن عرض، أو تدرب على الرد..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary-dark transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 text-center text-[10px] text-gray-400">
            الذكاء الاصطناعي يمكن أن يخطئ. تحقق من المعلومات.
          </div>
        </div>
      </div>
    </>
  );
}
