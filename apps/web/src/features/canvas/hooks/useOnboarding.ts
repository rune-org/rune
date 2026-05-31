"use client";

import { useCallback, useEffect, useState } from "react";

const ONBOARDING_KEY = "rune-onboarding-seen";

export function useOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setIsOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setIsOpen(false);
    setStep(0);
  }, []);

  const open = useCallback(() => {
    setStep(0);
    setIsOpen(true);
  }, []);

  return { isOpen, step, setStep, open, close };
}
