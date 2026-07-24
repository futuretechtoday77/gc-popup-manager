import { Redis } from "@upstash/redis";
import type {
  Popup,
  PopupField,
  Submission,
  PublicPopupConfig,
  PopupFolder,
} from "./types";
import { UNCATEGORIZED_FOLDER_ID, UNCATEGORIZED_FOLDER_NAME } from "./types";
import {
  normalizeButtonStyle,
  normalizeImageSettings,
  normalizeTrigger,
} from "./popup-shape";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ---- Key helpers ----
export const keys = {
  popup: (id: string) => `popup:${id}`,
  popupsIndex: () => `popups:index`,
  popupSubmissions: (id: string) => `popup:${id}:submissions`,
  submission: (id: string) => `submission:${id}`,
  queuePending: () => `queue:pending`,
  queueFailed: () => `queue:failed`,
  folder: (id: string) => `folder:${id}`,
  foldersIndex: () => `folders:index`,
};

// The Upstash client auto-serializes/deserializes JSON. When a value was
// stored as an object it comes back as an object; guard for string too.
function coerce<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

// Existing popups in Redis may still have the legacy `fields` boolean map and
// no `template` / `style.textColor`. Normalize any popup read from storage to
// the current shape before it is returned anywhere.
export function migratePopupFields(popup: any): Popup {
  if (!popup || typeof popup !== "object") return popup;

  const style = popup.style || {};
  const migratedStyle = {
    primaryColor: style.primaryColor || "#ffffff",
    buttonColor: style.buttonColor || "#22c55e",
    textColor: style.textColor || "#1a1a1a",
  };

  // Already the new array shape — only backfill template/style and return.
  if (Array.isArray(popup.fields)) {
    return {
      ...popup,
      template: popup.template || "classic",
      folderId: popup.folderId || UNCATEGORIZED_FOLDER_ID,
      buttonStyle: normalizeButtonStyle(popup.buttonStyle),
      imageSettings: normalizeImageSettings(
        popup.imageSettings,
        popup.template || "classic",
      ),
      trigger: normalizeTrigger(popup.trigger, popup.id),
      style: migratedStyle,
    } as Popup;
  }

  const oldFields = (popup.fields || {}) as Record<string, unknown>;
  const fields: PopupField[] = [
    {
      key: "firstName",
      enabled: !!oldFields.firstName,
      label: "First Name",
      placeholder: "Your first name",
      required: false,
      order: 0,
    },
    {
      key: "phone",
      enabled: !!oldFields.phone,
      label: "Phone",
      placeholder: "Your phone number",
      required: false,
      order: 1,
    },
    {
      key: "notes",
      enabled: !!oldFields.notes,
      label: "Notes",
      placeholder: "Anything else?",
      required: false,
      order: 2,
    },
  ];

  return {
    ...popup,
    template: popup.template || "classic",
    folderId: popup.folderId || UNCATEGORIZED_FOLDER_ID,
    buttonStyle: normalizeButtonStyle(popup.buttonStyle),
    imageSettings: normalizeImageSettings(
      popup.imageSettings,
      popup.template || "classic",
    ),
    trigger: normalizeTrigger(popup.trigger, popup.id),
    fields,
    style: migratedStyle,
  } as Popup;
}

export function normalizeFolder(folder: any): PopupFolder | null {
  if (!folder || typeof folder !== "object") return null;
  const id = String(folder.id || "").trim();
  const name = String(folder.name || "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    createdAt: String(folder.createdAt || new Date().toISOString()),
    updatedAt: String(
      folder.updatedAt || folder.createdAt || new Date().toISOString(),
    ),
  };
}

export function uncategorizedFolder(): PopupFolder {
  const now = new Date().toISOString();
  return {
    id: UNCATEGORIZED_FOLDER_ID,
    name: UNCATEGORIZED_FOLDER_NAME,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getFolder(id: string): Promise<PopupFolder | null> {
  if (id === UNCATEGORIZED_FOLDER_ID) return uncategorizedFolder();
  const redis = getRedis();
  return normalizeFolder(coerce(await redis.get(keys.folder(id))));
}

export async function getAllFolders(): Promise<PopupFolder[]> {
  const redis = getRedis();
  const ids = (await redis.smembers(keys.foldersIndex())) as string[];
  const folders = await Promise.all((ids || []).map((id) => getFolder(id)));
  const out = folders.filter((f): f is PopupFolder => f !== null);
  out.unshift(uncategorizedFolder());
  return out;
}

export async function saveFolder(folder: PopupFolder): Promise<void> {
  const redis = getRedis();
  await redis.set(keys.folder(folder.id), folder);
  await redis.sadd(keys.foldersIndex(), folder.id);
}

export async function deleteFolderAndMovePopups(
  folderId: string,
): Promise<void> {
  const redis = getRedis();
  const ids = (await redis.smembers(keys.popupsIndex())) as string[];
  const popups = await Promise.all((ids || []).map((id) => getPopup(id)));
  await Promise.all(
    popups
      .filter((p): p is Popup => !!p && p.folderId === folderId)
      .map((p) =>
        savePopup({
          ...p,
          folderId: UNCATEGORIZED_FOLDER_ID,
          updatedAt: new Date().toISOString(),
        }),
      ),
  );
  await redis.del(keys.folder(folderId));
  await redis.srem(keys.foldersIndex(), folderId);
}

// ---- Popup ops ----
export async function savePopup(popup: Popup): Promise<void> {
  const redis = getRedis();
  await redis.set(keys.popup(popup.id), popup);
  await redis.sadd(keys.popupsIndex(), popup.id);
}

export async function getPopup(id: string): Promise<Popup | null> {
  const redis = getRedis();
  const raw = coerce<Popup>(await redis.get(keys.popup(id)));
  return raw ? migratePopupFields(raw) : null;
}

export async function getAllPopupIds(): Promise<string[]> {
  const redis = getRedis();
  const ids = await redis.smembers(keys.popupsIndex());
  return (ids as string[]) ?? [];
}

export async function getAllPopups(): Promise<Popup[]> {
  const ids = await getAllPopupIds();
  const popups = await Promise.all(ids.map((id) => getPopup(id)));
  return popups.filter((p): p is Popup => p !== null);
}

export function toPublicConfig(popup: Popup): PublicPopupConfig {
  return {
    id: popup.id,
    template: popup.template,
    headline: popup.headline,
    subHeadline: popup.subHeadline,
    bodyText: popup.bodyText,
    buttonText: popup.buttonText,
    imageUrl: popup.imageUrl,
    imageSettings: normalizeImageSettings(popup.imageSettings, popup.template),
    fields: popup.fields,
    trigger: popup.trigger,
    thankYouUrl: popup.thankYouUrl,
    style: popup.style,
  };
}

// ---- Submission ops ----
export async function saveSubmission(sub: Submission): Promise<void> {
  const redis = getRedis();
  await redis.set(keys.submission(sub.id), sub);
  await redis.zadd(keys.popupSubmissions(sub.popupId), {
    score: new Date(sub.submittedAt).getTime(),
    member: sub.id,
  });
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const redis = getRedis();
  return coerce<Submission>(await redis.get(keys.submission(id)));
}

export async function getSubmissionIdsForPopup(
  popupId: string,
): Promise<string[]> {
  const redis = getRedis();
  // Newest first.
  const ids = await redis.zrange(keys.popupSubmissions(popupId), 0, -1, {
    rev: true,
  });
  return (ids as string[]) ?? [];
}

export async function getSubmissionsForPopup(
  popupId: string,
): Promise<Submission[]> {
  const ids = await getSubmissionIdsForPopup(popupId);
  const subs = await Promise.all(ids.map((id) => getSubmission(id)));
  return subs.filter((s): s is Submission => s !== null);
}

export async function countSubmissionsForPopup(
  popupId: string,
): Promise<number> {
  const redis = getRedis();
  return (await redis.zcard(keys.popupSubmissions(popupId))) ?? 0;
}

export async function getAllSubmissions(): Promise<Submission[]> {
  const popups = await getAllPopups();
  const lists = await Promise.all(
    popups.map((p) => getSubmissionsForPopup(p.id)),
  );
  const all = lists.flat();
  all.sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  return all;
}

// ---- Queue ops ----
export async function enqueue(submissionId: string): Promise<void> {
  const redis = getRedis();
  await redis.rpush(keys.queuePending(), submissionId);
}

export async function queueDepth(): Promise<number> {
  const redis = getRedis();
  return (await redis.llen(keys.queuePending())) ?? 0;
}

export async function failedCount(): Promise<number> {
  const redis = getRedis();
  return (await redis.scard(keys.queueFailed())) ?? 0;
}
