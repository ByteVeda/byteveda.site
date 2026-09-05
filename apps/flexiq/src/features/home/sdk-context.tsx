"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { Sdk } from "@/lib/docs";

/**
 * The SDK chosen in the hero follows the reader down the page: feature links,
 * use-case links and the closing quickstart all resolve to the language they
 * picked, instead of dumping a Node developer into Python docs.
 */
const SdkContext = createContext<{ sdk: Sdk; setSdk: (sdk: Sdk) => void }>({
  sdk: "python",
  setSdk: () => {},
});

export function SdkProvider({ children }: { children: ReactNode }) {
  const [sdk, setSdk] = useState<Sdk>("python");
  const value = useMemo(() => ({ sdk, setSdk }), [sdk]);
  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
}

export function useSdk() {
  return useContext(SdkContext);
}
