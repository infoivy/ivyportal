import * as React from "react";
import PhoneInputLib, { getCountries, isValidPhoneNumber } from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
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

/**
 * Phone input with country flag select and national formatting, styled to
 * the app's tokens. Value is E.164 (+447700900123) or undefined.
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
      className={cn("isa-phone-input flex w-full items-center gap-2", className)}
      numberInputProps={{
        className:
          "flex-1 h-10 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-ring",
      }}
      {...rest}
    />
  );
}
