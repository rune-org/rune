"use client";

import { createContext, useContext } from "react";

export type MarketingDemoState = {
  amount: number;
  setAmount: (value: number) => void;
  running: boolean;
};

const MarketingDemoContext = createContext<MarketingDemoState | null>(null);

export const MarketingDemoProvider = MarketingDemoContext.Provider;

export function useMarketingDemo(): MarketingDemoState {
  return useContext(MarketingDemoContext) ?? { amount: 0, setAmount: () => {}, running: false };
}
