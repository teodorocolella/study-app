export interface ClassFolder {
  id: string;
  name: string;
  colorTag: string | null;
  userId: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  contentHtml: string;
  aiSummary: string | null;
  classFolderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  classFolderId: string;
  createdAt: string;
  _count: { cards: number };
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  deckId: string;
  createdAt: string;
}

export interface DashboardSummary {
  classes: { classId: string; name: string; colorTag: string | null; dueCount: number }[];
  totalDue: number;
  studiedToday: number;
  studiedThisWeek: number;
  streak: number;
}
