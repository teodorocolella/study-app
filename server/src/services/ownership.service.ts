import { ApiError } from "../middleware/errorHandler.js";
import { prisma } from "../prisma.js";

export async function getOwnedClassFolder(userId: string, classId: string) {
  const classFolder = await prisma.classFolder.findUnique({ where: { id: classId } });
  if (!classFolder || classFolder.userId !== userId) {
    throw new ApiError(404, "Class folder not found");
  }
  return classFolder;
}

export async function getOwnedNote(userId: string, noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { classFolder: true },
  });
  if (!note || note.classFolder.userId !== userId) {
    throw new ApiError(404, "Note not found");
  }
  return note;
}

export async function getOwnedDeck(userId: string, deckId: string) {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { classFolder: true },
  });
  if (!deck || deck.classFolder.userId !== userId) {
    throw new ApiError(404, "Deck not found");
  }
  return deck;
}

export async function getOwnedFlashcard(userId: string, cardId: string) {
  const card = await prisma.flashcard.findUnique({
    where: { id: cardId },
    include: { deck: { include: { classFolder: true } } },
  });
  if (!card || card.deck.classFolder.userId !== userId) {
    throw new ApiError(404, "Flashcard not found");
  }
  return card;
}
