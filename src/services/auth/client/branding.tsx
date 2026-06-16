import { createContext, useContext } from "react";

import type { ProjectPublicConfig } from "@/services/projects/schema";

const AuthBrandingContext = createContext<ProjectPublicConfig | null>(null);

export const AuthBrandingProvider = AuthBrandingContext.Provider;

export const useAuthBrandingConfig = () => useContext(AuthBrandingContext);
