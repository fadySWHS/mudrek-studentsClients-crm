'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

export interface LeadContextData {
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
}

interface AiContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  leadContext: LeadContextData | null;
  openWithPrompt: (prompt?: string, context?: LeadContextData) => void;
  draftPrompt: string;
  setDraftPrompt: (prompt: string) => void;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export function AiProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [leadContext, setLeadContext] = useState<LeadContextData | null>(null);
  const [draftPrompt, setDraftPrompt] = useState('');

  const openWithPrompt = (prompt = '', context?: LeadContextData) => {
    if (context) {
      setLeadContext(context);
    }
    setDraftPrompt(prompt);
    setIsOpen(true);
  };

  return (
    <AiContext.Provider
      value={{
        isOpen,
        setIsOpen,
        leadContext,
        openWithPrompt,
        draftPrompt,
        setDraftPrompt,
      }}
    >
      {children}
    </AiContext.Provider>
  );
}

export function useAi() {
  const context = useContext(AiContext);
  if (context === undefined) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return context;
}
