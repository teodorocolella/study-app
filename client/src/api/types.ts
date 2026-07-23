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

export interface MessagePartner {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export type MessageAttachment =
  | { type: "note"; title: string; contentHtml: string }
  | { type: "deck"; name: string; cards: { front: string; back: string }[] };

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string | null;
  attachment: MessageAttachment | null;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  partner: MessagePartner;
  lastMessage: Message;
  unreadCount: number;
}

export interface MessageThread {
  partner: MessagePartner;
  messages: Message[];
}

export interface ImportResult {
  type: "note" | "deck";
  noteId?: string;
  deckId?: string;
  classId: string;
}

export interface DashboardSummary {
  classes: { classId: string; name: string; colorTag: string | null; dueCount: number }[];
  totalDue: number;
  studiedToday: number;
  studiedThisWeek: number;
  streak: number;
}
