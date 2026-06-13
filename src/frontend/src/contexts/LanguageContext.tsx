import React, { createContext, useContext, useState } from 'react';

const LANG_KEY = 'wf_lang';

interface LanguageContextType {
  language: 'de' | 'en';
  setLanguage: (lang: 'de' | 'en') => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLang] = useState<'de' | 'en'>(
    () => (localStorage.getItem(LANG_KEY) as 'de' | 'en') ?? 'de'
  );

  const setLanguage = (lang: 'de' | 'en') => {
    setLang(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
