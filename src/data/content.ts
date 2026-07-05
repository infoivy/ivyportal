export type TabId =
  | "stages" | "inbound" | "outbound" | "story" | "conv" | "dmclose"
  | "objections" | "psych" | "engage" | "lang" | "frame" | "pacing";

export const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "stages", label: "The 8 Stages", color: "var(--tab-stages)" },
  { id: "inbound", label: "Inbound Flow", color: "var(--tab-inbound)" },
  { id: "outbound", label: "Outbound Openers", color: "var(--tab-outbound)" },
  { id: "story", label: "Story Replies", color: "var(--tab-story)" },
  { id: "conv", label: "Outbound Conv. Flow", color: "var(--tab-conv)" },
  { id: "dmclose", label: "DM Close", color: "var(--tab-dmclose)" },
  { id: "objections", label: "Objections", color: "var(--tab-objections)" },
  { id: "psych", label: "Psychology", color: "var(--tab-psych)" },
  { id: "engage", label: "Engagement", color: "var(--tab-engage)" },
  { id: "lang", label: "Language & Tone", color: "var(--tab-lang)" },
  { id: "frame", label: "Frameworks", color: "var(--tab-frame)" },
  { id: "pacing", label: "Pacing & Ops", color: "var(--tab-pacing)" },
];

export type Card = {
  title: string;
  subtitle?: string;
  body: React.ReactNode;
};

export type Section = {
  id: TabId;
  heading: string;
  color: string;
  cards: Card[];
};
