import { useEffect } from "react";
import { create } from "zustand";
import { useSettings } from "./settings";
import { useAccounts } from "./accounts";

/** Onboarding state lives apart from the screen so the screen can load only when it opens. */
export type Step = "welcome" | "name" | "backup" | "follows" | "signin";
export const useOnb = create<{ open: boolean; step: Step; mode: "first" | "add" }>()(() => ({ open: false, step: "welcome", mode: "first" }));

export function openOnboarding(step: Step = "welcome", mode: "first" | "add" = "first") {
  useOnb.setState({ open: true, step, mode });
}
export function closeOnboarding() {
  useOnb.setState({ open: false });
  useSettings.getState().set({ onboarded: true });
}

export function useOnboarding() {
  const open = useOnb((s) => s.open);
  const onboarded = useSettings((s) => s.onboarded);
  const accounts = useAccounts((s) => s.accounts.length);
  useEffect(() => {
    if (!onboarded && !accounts) useOnb.setState({ open: true, step: "welcome", mode: "first" });
  }, [onboarded, accounts]);
  return open;
}

