import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeChoice = "light" | "dark" | "system";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("isa-theme-v2");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // Rebrand 2026-08-13: light is the brand default, not the OS preference.
  return "light";
}

function applyChoice(choice: ThemeChoice) {
  const dark = choice === "system" ? systemPrefersDark() : choice === "dark";
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("isa-theme-v2", choice);
}

/**
 * Theme picker: Light / Dark / System (founder-directed 2026-07-27 · a menu,
 * not a blind toggle). "system" follows the OS live via the media query.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    const c = getStoredChoice();
    setChoice(c);
    applyChoice(c);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredChoice() === "system") applyChoice("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const pick = (c: ThemeChoice) => {
    setChoice(c);
    applyChoice(c);
  };

  const effectiveDark = choice === "dark" || (choice === "system" && typeof window !== "undefined" && systemPrefersDark());

  const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-12 w-12 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors motion-safe:duration-150 hover:text-foreground hover:bg-muted"
          title="Theme"
          aria-label="Theme"
        >
          {choice === "system" ? <Monitor className="h-4 w-4" /> : effectiveDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[130px]">
        {OPTIONS.map(o => (
          <DropdownMenuItem key={o.value} onClick={() => pick(o.value)} className="text-xs gap-2">
            <o.icon className="h-3.5 w-3.5 text-muted-foreground" />
            {o.label}
            {choice === o.value && <Check className="h-3 w-3 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
