import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  onDraftNotice?: (content: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onDraftNotice }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([
    { role: 'model', parts: [{ text: "Hello Operative. I am your School Protocol Intelligence Assistant. How can I help you optimize your workflow today?" }] }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const extractAction = (text: string) => {
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.action === 'draft_notice' && jsonData.content) {
          return jsonData.content;
        }
      }
    } catch (e) {
      console.warn("Failed to parse AI action JSON", e);
    }
    return null;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user' as const, parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          history: messages.slice(1, -1) // slice to keep history manageable
        }),
      });

      const data = await response.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${data.error}` }] }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "System Error: Failed to connect to AI Hub." }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-280px)] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight">AI Command Center</h2>
            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Neural Link: ACTIVE</p>
          </div>
        </div>
        <button 
          onClick={() => setMessages([{ role: 'model', parts: [{ text: "Neural session reset. Awaiting commands." }] }])}
          className="p-2 hover:bg-white/10 rounded-lg transition-all"
          title="Reset Session"
        >
          <RefreshCw className="w-4 h-4 text-indigo-300" />
        </button>
      </div>

      {/* Chat History */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 no-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-indigo-600 shadow-sm'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                  </div>
                  
                  {msg.role === 'model' && extractAction(msg.parts[0].text) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-end gap-2">
                      <button 
                        onClick={() => onDraftNotice?.(extractAction(msg.parts[0].text)!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all active:scale-95 text-[9px] uppercase tracking-wider font-black whitespace-nowrap cursor-pointer"
                      >
                        <Calendar className="w-3 h-3 text-indigo-600" />
                        Schedule Draft
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex justify-start"
          >
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message or command..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-5 pr-16 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none shadow-inner no-scrollbar"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-300 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">
          Powered by Gemini Intelligence &bull; Standard Operating Protocol
        </p>
      </div>
    </div>
  );
};
