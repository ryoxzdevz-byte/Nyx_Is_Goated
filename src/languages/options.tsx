import type { SelectOption } from "@/shared/ui/Select";
import type { Locale } from "./locale";

// Offline-safe flag badges (no remote image assets, so nothing breaks without a connection).
function LocaleBadge({ code }: { code: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[16px] min-w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-fill px-[3px] text-[8px] font-[700] uppercase tracking-[0.02em] text-text-secondary"
    >
      {code}
    </span>
  );
}

// shared locale options used across auth-wall and settings modal
export const LOCALE_OPTIONS: SelectOption<Locale>[] = [
  {
    value: "en",
    label: "English",
    icon: <LocaleBadge code="EN" />,
  },
  {
    value: "es",
    label: "Español",
    icon: <LocaleBadge code="ES" />,
  },
  {
    value: "ru",
    label: "Русский",
    icon: <LocaleBadge code="RU" />,
  },
  {
    value: "uk",
    label: "Українська",
    icon: <LocaleBadge code="UA" />,
  },
  {
    value: "de",
    label: "Deutsch",
    icon: <LocaleBadge code="DE" />,
  },
  {
    value: "it",
    label: "Italiano",
    icon: <LocaleBadge code="IT" />,
  },
  {
    value: "fr",
    label: "Français",
    icon: <LocaleBadge code="FR" />,
  },
  {
    value: "pl",
    label: "Polski",
    icon: <LocaleBadge code="PL" />,
  },
  {
    value: "tr",
    label: "Türkçe",
    icon: <LocaleBadge code="TR" />,
  },
  {
    value: "pt",
    label: "Português (Brasil)",
    icon: <LocaleBadge code="BR" />,
  },
  {
    value: "id",
    label: "Bahasa Indonesia",
    icon: <LocaleBadge code="ID" />,
  },
];
