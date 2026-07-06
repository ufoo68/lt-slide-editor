import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";

export type DeckVisibility = "private" | "public";

export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Deck = {
  id: string;
  userId: string;
  title: string;
  slug: string;
  markdown: string;
  presentationMinutes: number;
  visibility: DeckVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type SlideLibraryItem = {
  id: string;
  userId: string;
  title: string;
  markdown: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaLibraryItem = {
  id: string;
  userId: string;
  filename: string;
  storagePath: string;
  contentType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
};

type FirestoreDate = Date | Timestamp | string | number | undefined;

const collections = {
  users: "users",
  decks: "decks",
  slideLibraryItems: "slideLibraryItems",
  mediaLibraryItems: "mediaLibraryItems",
} as const;

function db() {
  return getAdminFirestore();
}

function asDate(value: FirestoreDate) {
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value) {
    return new Date(value);
  }
  return new Date(0);
}

function byUpdatedAtDesc<T extends { updatedAt: Date }>(items: T[]) {
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function docData<T extends object>(id: string, data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) {
    return null;
  }

  return { id, ...data } as T & { id: string };
}

function mapUser(id: string, data: FirebaseFirestore.DocumentData | undefined): AppUser | null {
  const user = docData<Omit<AppUser, "createdAt" | "updatedAt">>(id, data);
  if (!user) {
    return null;
  }

  return {
    ...user,
    name: user.name ?? null,
    createdAt: asDate(data?.createdAt),
    updatedAt: asDate(data?.updatedAt),
  };
}

function mapDeck(id: string, data: FirebaseFirestore.DocumentData | undefined): Deck | null {
  const deck = docData<Omit<Deck, "createdAt" | "updatedAt">>(id, data);
  if (!deck) {
    return null;
  }

  return {
    ...deck,
    createdAt: asDate(data?.createdAt),
    updatedAt: asDate(data?.updatedAt),
  };
}

function mapSlide(id: string, data: FirebaseFirestore.DocumentData | undefined): SlideLibraryItem | null {
  const slide = docData<Omit<SlideLibraryItem, "createdAt" | "updatedAt">>(id, data);
  if (!slide) {
    return null;
  }

  return {
    ...slide,
    createdAt: asDate(data?.createdAt),
    updatedAt: asDate(data?.updatedAt),
  };
}

function mapMedia(id: string, data: FirebaseFirestore.DocumentData | undefined): MediaLibraryItem | null {
  const media = docData<Omit<MediaLibraryItem, "createdAt" | "updatedAt">>(id, data);
  if (!media) {
    return null;
  }

  return {
    ...media,
    createdAt: asDate(data?.createdAt),
    updatedAt: asDate(data?.updatedAt),
  };
}

export async function upsertUser(input: { firebaseUid: string; email: string; name: string | null }) {
  const ref = db().collection(collections.users).doc(input.firebaseUid);
  const snapshot = await ref.get();
  const now = new Date();

  await ref.set(
    {
      firebaseUid: input.firebaseUid,
      email: input.email,
      name: input.name,
      createdAt: snapshot.exists ? snapshot.data()?.createdAt ?? now : now,
      updatedAt: now,
    },
    { merge: true },
  );

  return mapUser(ref.id, (await ref.get()).data()) as AppUser;
}

export async function deckSlugExists(slug: string) {
  const snapshot = await db().collection(collections.decks).where("slug", "==", slug).limit(1).get();

  return !snapshot.empty;
}

export async function listDecks(userId: string) {
  const snapshot = await db().collection(collections.decks).where("userId", "==", userId).get();
  const decks = snapshot.docs.map((doc) => mapDeck(doc.id, doc.data())).filter((deck): deck is Deck => Boolean(deck));

  return byUpdatedAtDesc(decks);
}

export async function createDeck(input: {
  userId: string;
  title: string;
  markdown: string;
  presentationMinutes: number;
  visibility: DeckVisibility;
  slug: string;
}) {
  const deckRef = db().collection(collections.decks).doc();
  const now = new Date();

  await deckRef.set({
    userId: input.userId,
    title: input.title,
    slug: input.slug,
    markdown: input.markdown,
    presentationMinutes: input.presentationMinutes,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
  });

  return mapDeck(deckRef.id, (await deckRef.get()).data()) as Deck;
}

export async function getDeckForUser(id: string, userId: string) {
  const snapshot = await db().collection(collections.decks).doc(id).get();
  const deck = mapDeck(snapshot.id, snapshot.data());

  return deck?.userId === userId ? deck : null;
}

export async function getPublicDeckBySlug(slug: string) {
  const snapshot = await db().collection(collections.decks).where("slug", "==", slug).limit(1).get();
  const deck = snapshot.docs[0] ? mapDeck(snapshot.docs[0].id, snapshot.docs[0].data()) : null;

  return deck?.visibility === "public" ? deck : null;
}

export async function updateDeck(
  id: string,
  userId: string,
  input: { title: string; markdown: string; presentationMinutes: number; visibility: DeckVisibility },
) {
  const deckRef = db().collection(collections.decks).doc(id);
  const current = await getDeckForUser(id, userId);
  if (!current) {
    return null;
  }

  const now = new Date();
  await deckRef.update({
    title: input.title,
    markdown: input.markdown,
    presentationMinutes: input.presentationMinutes,
    visibility: input.visibility,
    updatedAt: now,
  });

  return mapDeck(deckRef.id, (await deckRef.get()).data()) as Deck;
}

export async function deleteDeck(id: string, userId: string) {
  const deck = await getDeckForUser(id, userId);
  if (!deck) {
    return false;
  }

  await db().collection(collections.decks).doc(id).delete();

  return true;
}

export async function listSlides(userId: string) {
  const snapshot = await db().collection(collections.slideLibraryItems).where("userId", "==", userId).get();
  const slides = snapshot.docs.map((doc) => mapSlide(doc.id, doc.data())).filter((slide): slide is SlideLibraryItem => Boolean(slide));

  return byUpdatedAtDesc(slides);
}

export async function createSlide(input: { userId: string; title: string; markdown: string }) {
  const ref = db().collection(collections.slideLibraryItems).doc();
  const now = new Date();
  await ref.set({ ...input, createdAt: now, updatedAt: now });

  return mapSlide(ref.id, (await ref.get()).data()) as SlideLibraryItem;
}

export async function getSlideForUser(id: string, userId: string) {
  const snapshot = await db().collection(collections.slideLibraryItems).doc(id).get();
  const slide = mapSlide(snapshot.id, snapshot.data());

  return slide?.userId === userId ? slide : null;
}

export async function updateSlide(id: string, userId: string, input: { title: string; markdown: string }) {
  const slide = await getSlideForUser(id, userId);
  if (!slide) {
    return null;
  }

  const ref = db().collection(collections.slideLibraryItems).doc(id);
  await ref.update({ ...input, updatedAt: new Date() });

  return mapSlide(ref.id, (await ref.get()).data()) as SlideLibraryItem;
}

export async function deleteSlide(id: string, userId: string) {
  const slide = await getSlideForUser(id, userId);
  if (!slide) {
    return false;
  }

  await db().collection(collections.slideLibraryItems).doc(id).delete();

  return true;
}

export async function listMedia(userId: string) {
  const snapshot = await db().collection(collections.mediaLibraryItems).where("userId", "==", userId).get();
  const media = snapshot.docs.map((doc) => mapMedia(doc.id, doc.data())).filter((item): item is MediaLibraryItem => Boolean(item));

  return byUpdatedAtDesc(media);
}

export async function createMedia(input: {
  userId: string;
  filename: string;
  storagePath: string;
  contentType: string;
  size: number;
}) {
  const ref = db().collection(collections.mediaLibraryItems).doc();
  const now = new Date();
  await ref.set({ ...input, createdAt: now, updatedAt: now });

  return mapMedia(ref.id, (await ref.get()).data()) as MediaLibraryItem;
}

export async function getMedia(id: string) {
  const snapshot = await db().collection(collections.mediaLibraryItems).doc(id).get();

  return mapMedia(snapshot.id, snapshot.data());
}

export async function getMediaForUser(id: string, userId: string) {
  const media = await getMedia(id);

  return media?.userId === userId ? media : null;
}

export async function deleteMedia(id: string, userId: string) {
  const media = await getMediaForUser(id, userId);
  if (!media) {
    return null;
  }

  await db().collection(collections.mediaLibraryItems).doc(id).delete();

  return media;
}
