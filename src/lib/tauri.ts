import { IncomeRecord, MonthlySummaryData, CreateRecordInput, UpdateRecordInput } from "../types";
import {
  encryptPayload,
  decryptPayload,
  isVaultUnlocked,
  EncryptedEnvelope,
} from "./crypto";
import {
  uploadEncryptedRecord,
  fetchAllEncryptedRecords,
  removeEncryptedRecord,
  uploadEncryptedPhoto,
  fetchEncryptedPhoto,
  removeEncryptedPhoto,
  getCurrentFirebaseUser,
} from "./firebase";

// Check if running inside Tauri desktop app
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

// Current authenticated user ID (if logged into Firebase)
let currentUserId: string | null = null;

export function setCurrentUserId(uid: string | null) {
  currentUserId = uid;
}

export function getActiveUserId(): string | null {
  return currentUserId || getCurrentFirebaseUser()?.uid || null;
}

// In-memory decrypted cache (strictly in memory, lost on lock)
let memoryRecords: IncomeRecord[] = [];

// Local storage key for encrypted fallback (when offline or demo)
const ENCRYPTED_LOCAL_STORAGE_KEY = "clinic_income_e2ee_records_v1";

export function getMemoryRecords(): IncomeRecord[] {
  return memoryRecords;
}

export function setMemoryRecords(records: IncomeRecord[]) {
  memoryRecords = records;
}

// Sync from Cloud Firestore (or local encrypted storage)
export async function syncEncryptedStorage(uid?: string | null): Promise<IncomeRecord[]> {
  if (!isVaultUnlocked()) {
    return [];
  }

  const targetUid = uid || getActiveUserId();

  // 1. If Firebase user is authenticated, sync from Firestore
  if (targetUid) {
    try {
      const encryptedItems = await fetchAllEncryptedRecords(targetUid);
      const decryptedList: IncomeRecord[] = [];

      for (const item of encryptedItems) {
        try {
          const rec = await decryptPayload<IncomeRecord>(item.envelope);
          decryptedList.push(rec);
        } catch (err) {
          console.warn(`Failed to decrypt record #${item.id}:`, err);
        }
      }

      memoryRecords = decryptedList;
      return memoryRecords;
    } catch (err) {
      console.error("Firestore sync failed, falling back to local storage:", err);
    }
  }

  // 2. Fallback: Load from local encrypted storage
  try {
    const raw = localStorage.getItem(ENCRYPTED_LOCAL_STORAGE_KEY);
    if (raw) {
      const encryptedEnvelopes: EncryptedEnvelope[] = JSON.parse(raw);
      const decryptedList: IncomeRecord[] = [];

      for (const env of encryptedEnvelopes) {
        try {
          const rec = await decryptPayload<IncomeRecord>(env);
          decryptedList.push(rec);
        } catch (err) {
          console.warn("Failed to decrypt local record envelope:", err);
        }
      }

      memoryRecords = decryptedList;
      return memoryRecords;
    }
  } catch (err) {
    console.error("Local encrypted storage load error:", err);
  }

  return memoryRecords;
}

// Save local encrypted backup
async function persistLocalEncryptedCache(records: IncomeRecord[]) {
  try {
    const envelopes: EncryptedEnvelope[] = [];
    for (const r of records) {
      const env = await encryptPayload(r);
      envelopes.push(env);
    }
    localStorage.setItem(ENCRYPTED_LOCAL_STORAGE_KEY, JSON.stringify(envelopes));
  } catch (err) {
    console.error("Failed to persist local encrypted cache:", err);
  }
}

// Calculate monthly summary from in-memory records
function calculateMonthlySummary(records: IncomeRecord[], year: number, month: number): MonthlySummaryData {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = records.filter((r) => r.entry_date.startsWith(monthStr));
  const total_amount = monthRecords.reduce((sum, r) => sum + r.amount, 0);
  const record_count = monthRecords.length;

  const daysInMonth = new Date(year, month, 0).getDate();
  const daily_average = daysInMonth > 0 ? Math.round(total_amount / daysInMonth) : 0;

  // Category breakdown
  const catMap = new Map<string, { total: number; count: number }>();
  monthRecords.forEach((r) => {
    const existing = catMap.get(r.category) || { total: 0, count: 0 };
    existing.total += r.amount;
    existing.count += 1;
    catMap.set(r.category, existing);
  });

  const category_breakdown = Array.from(catMap.entries())
    .map(([cat, data]) => ({
      category: cat,
      total: data.total,
      count: data.count,
      percentage: total_amount > 0 ? Math.round((data.total / total_amount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Payment breakdown
  const payMap = new Map<string, { total: number; count: number }>();
  monthRecords.forEach((r) => {
    const existing = payMap.get(r.payment_method) || { total: 0, count: 0 };
    existing.total += r.amount;
    existing.count += 1;
    payMap.set(r.payment_method, existing);
  });

  const payment_breakdown = Array.from(payMap.entries())
    .map(([method, data]) => ({
      payment_method: method,
      total: data.total,
      count: data.count,
      percentage: total_amount > 0 ? Math.round((data.total / total_amount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Daily breakdown
  const dayMap = new Map<string, { total: number; count: number }>();
  monthRecords.forEach((r) => {
    const existing = dayMap.get(r.entry_date) || { total: 0, count: 0 };
    existing.total += r.amount;
    existing.count += 1;
    dayMap.set(r.entry_date, existing);
  });

  const daily_breakdown = Array.from(dayMap.entries())
    .map(([d, data]) => ({
      date: d,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    year,
    month,
    month_str: monthStr,
    total_amount,
    record_count,
    daily_average,
    category_breakdown,
    payment_breakdown,
    daily_breakdown,
  };
}

// In-memory photo storage for decrypted photos
const photoDataStore = new Map<string, string>();

// Import an array of raw records (e.g. from local migration json), encrypt them and sync to cloud
export async function importRecordsList(rawRecords: any[]): Promise<number> {
  let count = 0;
  for (const r of rawRecords) {
    if (!r.entry_date || !r.amount) continue;
    const recordId = r.id || Date.now() + count;

    if (r.photo_base64 && r.photo_filename) {
      photoDataStore.set(r.photo_filename, r.photo_base64);
      if (isVaultUnlocked()) {
        try {
          const photoEnv = await encryptPayload({ data: r.photo_base64 });
          const activeUid = getActiveUserId();
          if (activeUid) {
            await uploadEncryptedPhoto(activeUid, r.photo_filename, photoEnv);
          }
        } catch (photoErr) {
          console.warn("Failed to encrypt and upload photo:", photoErr);
        }
      }
    }

    const cleanRecord: IncomeRecord = {
      id: recordId,
      entry_date: r.entry_date,
      amount: Number(r.amount),
      category: r.category || "保障底薪",
      payment_method: r.payment_method || "現金發放",
      payer_or_patient: r.payer_or_patient || "",
      photo_filename: r.photo_filename || null,
      note: r.note || "",
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    };

    const idx = memoryRecords.findIndex((m) => m.id === cleanRecord.id);
    if (idx >= 0) {
      memoryRecords[idx] = cleanRecord;
    } else {
      memoryRecords.push(cleanRecord);
    }

    if (isVaultUnlocked()) {
      const envelope = await encryptPayload(cleanRecord);
      const activeUid = getActiveUserId();
      if (activeUid) {
        await uploadEncryptedRecord(activeUid, cleanRecord.id, envelope);
      }
    }
    count++;
  }

  await persistLocalEncryptedCache(memoryRecords);
  return count;
}

// API client interfacing with memory cache and encrypted persistence
export const api = {

  getMonthlySummary: async (year: number, month: number): Promise<MonthlySummaryData> => {
    return calculateMonthlySummary(memoryRecords, year, month);
  },

  getRecords: async (month?: string, search?: string, category?: string): Promise<IncomeRecord[]> => {
    let filtered = [...memoryRecords];
    if (month) {
      filtered = filtered.filter((r) => r.entry_date.startsWith(month));
    }
    if (category && category !== "全部") {
      filtered = filtered.filter((r) => r.category === category);
    }
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.note.toLowerCase().includes(term) ||
          r.payer_or_patient.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          r.payment_method.toLowerCase().includes(term) ||
          r.amount.toString().includes(term) ||
          r.entry_date.includes(term)
      );
    }
    filtered.sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id);
    return filtered;
  },

  addRecord: async (input: CreateRecordInput): Promise<IncomeRecord> => {
    const newId = Date.now();
    let photoFilename: string | null = null;

    if (input.photo_base64) {
      photoFilename = `photo_${newId}.${input.photo_ext || "png"}`;
      photoDataStore.set(photoFilename, input.photo_base64);
    }

    const newRecord: IncomeRecord = {
      id: newId,
      entry_date: input.entry_date,
      amount: Number(input.amount),
      category: input.category,
      payment_method: input.payment_method,
      payer_or_patient: input.payer_or_patient || "",
      photo_filename: photoFilename,
      note: input.note || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryRecords.push(newRecord);

    // Encrypt and persist
    if (isVaultUnlocked()) {
      const envelope = await encryptPayload(newRecord);
      const activeUid = getActiveUserId();
      if (activeUid) {
        await uploadEncryptedRecord(activeUid, newId, envelope);
        if (input.photo_base64 && photoFilename) {
          try {
            const photoEnv = await encryptPayload({ data: input.photo_base64 });
            await uploadEncryptedPhoto(activeUid, photoFilename, photoEnv);
          } catch (photoErr) {
            console.warn("Failed to upload photo:", photoErr);
          }
        }
      }
      await persistLocalEncryptedCache(memoryRecords);
    }

    return newRecord;
  },

  updateRecord: async (input: UpdateRecordInput): Promise<IncomeRecord> => {
    const idx = memoryRecords.findIndex((r) => r.id === input.id);
    if (idx === -1) throw new Error("找不到此筆紀錄");

    const activeUid = getActiveUserId();
    const oldPhotoFilename = memoryRecords[idx].photo_filename;
    let photoFilename = oldPhotoFilename;
    if (input.remove_photo) {
      if (photoFilename) {
        photoDataStore.delete(photoFilename);
        if (activeUid) {
          removeEncryptedPhoto(activeUid, photoFilename).catch(console.warn);
        }
      }
      photoFilename = null;
    } else if (input.photo_base64) {
      photoFilename = `photo_${input.id}.jpg`;
      photoDataStore.set(photoFilename, input.photo_base64);
      if (isVaultUnlocked() && activeUid) {
        try {
          const pEnv = await encryptPayload({ data: input.photo_base64 });
          await uploadEncryptedPhoto(activeUid, photoFilename, pEnv);
        } catch (photoErr) {
          console.warn("Failed to upload updated photo:", photoErr);
        }
      }
    }

    const updatedRecord: IncomeRecord = {
      ...memoryRecords[idx],
      entry_date: input.entry_date,
      amount: Number(input.amount),
      category: input.category,
      payment_method: input.payment_method,
      payer_or_patient: input.payer_or_patient || "",
      photo_filename: photoFilename,
      note: input.note || "",
      updated_at: new Date().toISOString(),
    };

    memoryRecords[idx] = updatedRecord;

    // Encrypt and persist
    if (isVaultUnlocked()) {
      const envelope = await encryptPayload(updatedRecord);
      if (activeUid) {
        await uploadEncryptedRecord(activeUid, input.id, envelope);
      }
      await persistLocalEncryptedCache(memoryRecords);
    }

    return updatedRecord;
  },

  deleteRecord: async (id: number): Promise<boolean> => {
    const activeUid = getActiveUserId();
    const record = memoryRecords.find((r) => r.id === id);
    if (record?.photo_filename) {
      photoDataStore.delete(record.photo_filename);
      if (activeUid) {
        removeEncryptedPhoto(activeUid, record.photo_filename).catch(console.warn);
      }
    }

    memoryRecords = memoryRecords.filter((r) => r.id !== id);

    if (activeUid) {
      await removeEncryptedRecord(activeUid, id);
    }
    await persistLocalEncryptedCache(memoryRecords);

    return true;
  },

  getPhotoData: async (filename: string): Promise<string | null> => {
    // 1. Check in-memory store first
    const cached = photoDataStore.get(filename);
    if (cached) return cached;

    // 2. Fetch encrypted photo from Firestore if logged in
    const activeUid = getActiveUserId();
    if (isVaultUnlocked() && activeUid) {
      try {
        const photoEnv = await fetchEncryptedPhoto(activeUid, filename);
        if (photoEnv) {
          const decrypted = await decryptPayload<{ data: string }>(photoEnv);
          if (decrypted?.data) {
            photoDataStore.set(filename, decrypted.data);
            return decrypted.data;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch/decrypt photo ${filename}:`, err);
      }
    }

    return null;
  },

  exportCsv: async (month: string): Promise<string> => {
    const monthRecords = memoryRecords.filter((r) => r.entry_date.startsWith(month));
    const header = "\uFEFF入賬日期,實領金額(NTD),薪資項目,入帳方式,發薪診所/醫療院所,明細備註,薪資條/存摺相片\n";
    const rows = monthRecords
      .map(
        (r) =>
          `"${r.entry_date}","${r.amount}","${r.category}","${r.payment_method}","${r.payer_or_patient.replace(
            /"/g,
            '""'
          )}","${r.note.replace(/"/g, '""')}","${r.photo_filename ? "有" : "無"}"`
      )
      .join("\n");
    return header + rows;
  },
};
