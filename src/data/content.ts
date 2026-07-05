import type { ReactNode } from "react";

export type TabId =
  | "stages" | "inbound" | "outbound" | "story" | "conv" | "dmclose"
  | "psych" | "engage" | "pacing";

export const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "stages", label: "The 8 Stages", color: "var(--tab-stages)" },
  { id: "inbound", label: "Inbound Flow", color: "var(--tab-inbound)" },
  { id: "outbound", label: "Outbound Openers", color: "var(--tab-outbound)" },
  { id: "story", label: "Story Replies", color: "var(--tab-story)" },
  { id: "conv", label: "Outbound Conv. Flow", color: "var(--tab-conv)" },
  { id: "dmclose", label: "DM Close & Objections", color: "var(--tab-dmclose)" },
  { id: "psych", label: "Psychology", color: "var(--tab-psych)" },
  { id: "engage", label: "Engagement", color: "var(--tab-engage)" },
  { id: "pacing", label: "Tracking & Ops", color: "var(--tab-pacing)" },
];

export type Card = {
  title: string;
  subtitle?: string;
  body: ReactNode;
};

export type Section = {
  id: TabId;
  heading: string;
  color: string;
  cards: Card[];
};
