import { useAccess } from "@/lib/use-access";

/**
 * Wraps a money figure; renders it pixelated/blurred when the admin access
 * defaults hide revenue numbers for every role the viewer holds.
 * Cosmetic only — real data protection lives in RLS.
 */
export function BlurMoney({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { hideMoney } = useAccess();
  if (!hideMoney) return <span className={className}>{children}</span>;
  return (
    <span
      className={`select-none blur-[7px] opacity-80 ${className}`}
      title="Hidden by access defaults"
      aria-label="Amount hidden"
    >
      {children}
    </span>
  );
}
