import * as React from "react";
import PhoneInputLib, { getCountries, getCountryCallingCode, isValidPhoneNumber } from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export { isValidPhoneNumber };

/**
 * Best-guess default country from the browser locale (en-GB → GB), falling
 * back to a timezone-city map for locales without a region. Never throws.
 */
export function detectCountry(): Country | undefined {
  const countries = new Set<string>(getCountries());
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && countries.has(region)) return region as Country;
  } catch { /* fall through */ }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const byTz: Record<string, string> = {
      "Europe/London": "GB", "Europe/Amsterdam": "NL", "Europe/Paris": "FR", "Europe/Berlin": "DE",
      "Europe/Stockholm": "SE", "Europe/Istanbul": "TR", "Asia/Riyadh": "SA", "Asia/Dubai": "AE",
      "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY",
      "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
      "America/Toronto": "CA", "Africa/Cairo": "EG", "Africa/Lagos": "NG", "Africa/Nairobi": "KE",
      "Australia/Sydney": "AU",
    };
    const c = byTz[tz];
    if (c && countries.has(c)) return c as Country;
  } catch { /* fall through */ }
  return undefined;
}

const flagOf = (c?: string) =>
  c ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => ch.charCodeAt(0) + 127397)) : "🌐";

const callingCodeOf = (c?: Country) => {
  if (!c) return null;
  try { return `+${getCountryCallingCode(c)}`; } catch { return null; }
};

type CountryOption = { value?: Country; label: string; divider?: boolean };

/**
 * Country picker: closed it shows flag + dial code in a proper field; open
 * it's the native select (searchable by typing, right on mobile) with
 * "flag name +code" options. Founder 2026-07-28: nicer than the bare
 * type-in-with-flag element.
 */
function CountrySelect({ value, onChange, options, disabled, className }: {
  value?: Country;
  onChange: (value?: Country) => void;
  options: CountryOption[];
  disabled?: boolean;
  className?: string;
}) {
  const code = callingCodeOf(value);
  return (
    <div
      className={cn(
        "relative flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5",
        "focus-within:border-ring hover:border-ring/50 motion-safe:transition-colors",
        disabled && "opacity-50",
        className,
      )}
    >
      <span className="text-base leading-none" aria-hidden="true">{flagOf(value)}</span>
      <span className="text-[13px] tabular-nums text-muted-foreground">{code ?? ""}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <select
        value={value ?? "ZZ"}
        onChange={e => onChange(e.target.value === "ZZ" ? undefined : (e.target.value as Country))}
        disabled={disabled}
        aria-label="Country"
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      >
        {options.filter(o => !o.divider).map(o => {
          const dial = callingCodeOf(o.value);
          return (
            <option key={o.value ?? "ZZ"} value={o.value ?? "ZZ"}>
              {flagOf(o.value)} {o.label}{dial ? ` ${dial}` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

/**
 * Phone input with country select and national formatting, styled to the
 * app's tokens. Value is E.164 (+447700900123) or undefined.
 */
export function PhoneInput({ value, onChange, className, ...rest }: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const defaultCountry = React.useMemo(() => detectCountry(), []);
  return (
    <PhoneInputLib
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry}
      value={value}
      onChange={onChange}
      countrySelectComponent={CountrySelect}
      className={cn("isa-phone-input flex w-full items-center gap-2", className)}
      numberInputProps={{
        className:
          "flex-1 min-w-0 h-11 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring motion-safe:transition-colors",
      }}
      {...rest}
    />
  );
}
