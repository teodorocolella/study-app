-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "backImage" TEXT,
ADD COLUMN     "frontImage" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'basic',
ADD COLUMN     "occlusionsJson" TEXT;
