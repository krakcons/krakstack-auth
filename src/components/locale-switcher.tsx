import { LocaleSwitcher as RegistryLocaleSwitcher } from "@krak-stack/registry/locale-switcher";

import { setLocale } from "@/paraglide/runtime";

export const LocaleSwitcher = () => (
  <RegistryLocaleSwitcher
    onLocaleChange={(locale) => setLocale(locale === "fr" ? "fr" : "en")}
  />
);
