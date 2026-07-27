import { ArrowLeft, Pencil, Play, Plus, ScanEye, Share2, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Deck, Flashcard } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { useAssistantRefresh } from "../hooks/useAssistantRefresh";
import { ImagePicker } from "../components/cards/ImagePicker";
import { OcclusionCardModal } from "../components/cards/OcclusionCardModal";
import { ShareModal } from "../components/share/ShareModal";

export function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [occlusionOpen, setOcclusionOpen] = useState(false);

  async function load() {
    if (!deckId) return;
    const [deckData, cardList] = await Promise.all([
      api.get<Deck>(`/decks/${deckId}`),
      api.get<Flashcard[]>(`/decks/${deckId}/cards`),
    ]);
    setDeck(deckData);
    setCards(cardList);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Re-fetch when the AI assistant changes this deck's cards.
  useAssistantRefresh(() => void load().catch(() => {}));

  async function handleAddCard(e: FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim() || !deckId) return;
    try {
      const card = await api.post<Flashcard>(`/decks/${deckId}/cards`, {
        front,
        back,
        frontImage,
        backImage,
      });
      setCards((prev) => [...prev, card]);
      setFront("");
      setBack("");
      setFrontImage(null);
      setBackImage(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add card");
    }
  }

  function handleOcclusionCreated(card: Flashcard) {
    setCards((prev) => [...prev, card]);
    setOcclusionOpen(false);
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  }

  async function saveEdit(cardId: string) {
    const updated = await api.patch<Flashcard>(`/cards/${cardId}`, {
      front: editFront,
      back: editBack,
    });
    setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
    setEditingId(null);
  }

  async function handleDeleteCard(cardId: string) {
    await api.delete(`/cards/${cardId}`);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  async function handleDeleteDeck() {
    if (!deckId || !deck) return;
    const detail = cards.length
      ? ` This permanently deletes ${cards.length} card${cards.length === 1 ? "" : "s"}.`
      : "";
    if (!confirm(`Delete "${deck.name}"?${detail}`)) return;
    await api.delete(`/decks/${deckId}`);
    navigate(`/classes/${deck.classFolderId}`);
  }

  return (
    <AppShell>
      {deck && (
        <Link
          to={`/classes/${deck.classFolderId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to class
        </Link>
      )}

      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-slate-800 dark:text-slate-100">{deck?.name}</h1>
        <div className="flex items-center gap-3">
          {cards.length > 0 && (
            <Link
              to={`/decks/${deckId}/study`}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Study
            </Link>
          )}
          {cards.length > 0 && (
            <button
              onClick={() => setSharing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          )}
          <button
            onClick={() => void handleDeleteDeck()}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 space-y-2.5">
        {cards.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No cards yet — add one below.</p>}
        {cards.map((card) =>
          editingId === card.id ? (
            <div
              key={card.id}
              className="animate-flip-in space-y-2 rounded-xl border border-violet-300 bg-white dark:bg-slate-800 p-4 shadow-sm"
            >
              <input
                value={editFront}
                onChange={(e) => setEditFront(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <input
                value={editBack}
                onChange={(e) => setEditBack(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void saveEdit(card.id)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={card.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                {card.kind === "image_occlusion" ? (
                  <div className="flex items-center gap-3">
                    {card.frontImage && (
                      <img src={card.frontImage} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                        <ScanEye className="h-4 w-4 text-violet-500" />
                        Image occlusion
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{card.back}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {card.frontImage && (
                      <img src={card.frontImage} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{card.front}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{card.back}</p>
                    </div>
                    {card.backImage && (
                      <img src={card.backImage} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                {card.kind !== "image_occlusion" && (
                  <button onClick={() => startEdit(card)} className="hover:text-violet-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => void handleDeleteCard(card.id)} className="hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      <form onSubmit={handleAddCard} className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Add a card</p>
          <button
            type="button"
            onClick={() => setOcclusionOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            <ScanEye className="h-3.5 w-3.5" />
            Image-occlusion card
          </button>
        </div>
        <div className="flex items-start gap-2">
          <input
            type="text"
            placeholder="Front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <ImagePicker value={frontImage} onChange={setFrontImage} label="Front photo" />
        </div>
        <div className="flex items-start gap-2">
          <input
            type="text"
            placeholder="Back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <ImagePicker value={backImage} onChange={setBackImage} label="Back photo" />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          Add card
        </button>
      </form>

      {sharing && deckId && deck && (
        <ShareModal
          attachment={{ type: "deck", id: deckId }}
          label={deck.name}
          onClose={() => setSharing(false)}
        />
      )}
      {occlusionOpen && deckId && (
        <OcclusionCardModal
          deckId={deckId}
          onClose={() => setOcclusionOpen(false)}
          onCreated={handleOcclusionCreated}
        />
      )}
    </AppShell>
  );
}
