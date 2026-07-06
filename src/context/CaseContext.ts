import { createContext, useContext } from "react";
import type { CaseBundle } from "../types";

/** Provides the active case to everything inside a patient workspace. */
export const CaseContext = createContext<CaseBundle | null>(null);

/**
 * The active case. Only call from components rendered inside a patient
 * workspace (under a CaseContext.Provider); the patient list and top system
 * bar live outside it.
 */
export function useCase(): CaseBundle {
  const bundle = useContext(CaseContext);
  if (!bundle) throw new Error("useCase called outside CaseContext.Provider");
  return bundle;
}
