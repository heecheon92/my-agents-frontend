"use client";

import { useContext } from "react";
import {
  LocalizationContext,
  type LocalizationState,
} from "@/providers/localization";

const missingProviderError =
  "useLocalization must be used within a LocalizationProvider";

export function useLocalization(): LocalizationState;
export function useLocalization<TSelection>(
  selectorFn: (state: LocalizationState) => TSelection,
): Omit<LocalizationState, "localization"> & { localization: TSelection };
export function useLocalization<TSelection>(
  selectorFn?: (state: LocalizationState) => TSelection,
) {
  const state = useContext(LocalizationContext);
  if (!state) throw new Error(missingProviderError);

  if (!selectorFn) return state;

  return {
    ...state,
    localization: selectorFn(state),
  };
}
