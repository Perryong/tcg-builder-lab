export type Card = {
  id: string; number: string; setCode: string; name: string;
  colors: string[]; type: string; rarity: string; cost: number | null;
  power: number | null; counter: number | null; life: number | null;
  traits: string[]; text: string; trigger: string; imageUrl: string; sourceUrl: string;
  block: string | null; attribute: string;
};
export type SetRecord = {
  code: string; name: string; series: string; category: string;
  releaseDate: string | null; sourceUrl: string; expectedArtworks: number;
};
export type CatalogSnapshot = {
  region: string; checkedAt: string; coverage: 'partial' | 'complete';
  coverageNotes: string; sets: SetRecord[]; cards: Card[];
};
export type RulesSnapshot = {
  region: string; checkedAt: string; verified: boolean; sourceUrls: string[];
  mainCount: number; donCount: number; copyLimit: number;
  restrictions: { number: string; limit: number; effectiveFrom: string }[];
  bannedPairs: { numbers: [string, string]; effectiveFrom: string }[];
  copyExceptions: Record<string, number>; leaderExceptions: Record<string, { mainCount?: number; onlyTraits?: string[] }>;
  notes: string[];
};
export type EventRecord = {
  id: string; name: string; date: string; region: string; country: string;
  sourceUrl: string; placement: string; player: string; leaderNumber: string;
  list: Record<string, number> | null;
};
export type ArchetypeNote = {
  leaderNumber: string; title: string; style: string; sourceUrls: string[];
  publishedAt: string; region: string; gamePlan: string;
  strengths: string[]; weaknesses: string[]; suggestions: string[];
};
export type MetaSnapshot = {
  checkedAt: string; region: string; coverageNotes: string;
  events: EventRecord[]; archetypes: ArchetypeNote[];
};
