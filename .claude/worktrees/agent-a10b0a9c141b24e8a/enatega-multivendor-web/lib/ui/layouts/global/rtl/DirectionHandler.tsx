
// components/DirectionHandler.tsx
"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

export function DirectionHandler() {
  const locale = useLocale();

  useEffect(() => {
    const base = locale.split("-")[0];
    const RTL = ["ar", "fa", "ur", "he", "ps", "ku"];
    const isRTL = RTL.includes(locale) || RTL.includes(base);
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    if (isRTL) document.body.classList.add("rtl");
    else document.body.classList.remove("rtl");
  }, [locale]);

  return null
}