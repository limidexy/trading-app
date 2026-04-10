import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DateContextType {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export const DateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
};

export const useDate = () => {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
};
