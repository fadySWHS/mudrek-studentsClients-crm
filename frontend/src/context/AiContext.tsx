'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

export interface LeadContextData {
  id: string;
  name: string;
  service: string | null | undefined;
  budget: string | null | undefined;
  notes: string | null | undefined;
}

interface AiContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  leadContext: LeadContextData | null;
  openWithPrompt: (prompt: string, context?: LeadContextData) => void;
  initialPrompt: string;
  setInitialPrompt: (prompt: string) => void;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export function AiProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [leadContext, setLeadContext] = useState<LeadContextData | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string>('');

  const openWithPrompt = (prompt: string, context?: LeadContextData) => {
    if (context) {
      setLeadContext(context);
    }
    setInitialPrompt(prompt);
    setIsOpen(true);
  };

  return (
    <AiContext.Provider value={{ isOpen, setIsOpen, leadContext, openWithPrompt, initialPrompt, setInitialPrompt }}>
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
