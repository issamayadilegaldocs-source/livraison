"use client";

import { useTranslations } from "next-intl";

export default function LocalizedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-gray-600">{t("something_went_wrong_please_try_again")}</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90"
      >
        {t("retry_button")}
      </button>
    </div>
  );
}
