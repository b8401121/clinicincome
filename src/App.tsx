import { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import { Header } from "./components/Header";
import { MonthlySummary } from "./components/MonthlySummary";
import { RecordList } from "./components/RecordList";
import { RecordFormModal } from "./components/RecordFormModal";
import { PhotoLightbox } from "./components/PhotoLightbox";
import { AuthScreen } from "./components/AuthScreen";
import { FirebaseConfigModal } from "./components/FirebaseConfigModal";
import { SecurityModal } from "./components/SecurityModal";
import { IncomeRecord, MonthlySummaryData } from "./types";
import {
  api,
  syncEncryptedStorage,
  setCurrentUserId,
} from "./lib/tauri";
import { isVaultUnlocked, lockVault } from "./lib/crypto";
import { subscribeAuth } from "./lib/firebase";

export function App() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);

  // Auth & E2EE Vault state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isFirebaseConfigOpen, setIsFirebaseConfigOpen] = useState<boolean>(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState<boolean>(false);

  // Data states
  const [summary, setSummary] = useState<MonthlySummaryData | null>(null);
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<IncomeRecord | null>(null);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState("");

  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // 1. Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      setCurrentUser(user);
      setCurrentUserId(user?.uid || null);
      if (!user) {
        // If user signs out, lock vault
        lockVault();
        setIsUnlocked(false);
      }
    });
    return () => unsub();
  }, []);

  // 2. Load records and monthly summary
  const loadData = useCallback(async () => {
    if (!isVaultUnlocked()) return;

    try {
      setLoading(true);
      const [sumData, recs] = await Promise.all([
        api.getMonthlySummary(currentYear, currentMonth),
        api.getRecords(currentMonthStr),
      ]);
      setSummary(sumData);
      setRecords(recs);
    } catch (err) {
      console.error("Failed to load records:", err);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, currentMonthStr]);

  // When vault is unlocked, perform initial cloud/local sync
  const handleVaultUnlocked = async (user: User | null) => {
    setCurrentUser(user);
    setCurrentUserId(user?.uid || null);
    setIsUnlocked(true);
    setLoading(true);
    try {
      await syncEncryptedStorage(user?.uid);
      await loadData();
    } catch (err) {
      console.error("Error during vault unlock sync:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadData();
    }
  }, [isUnlocked, loadData]);

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleOpenAddModal = () => {
    setRecordToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditRecord = (record: IncomeRecord) => {
    setRecordToEdit(record);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (id: number) => {
    try {
      await api.deleteRecord(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete record:", err);
      alert("刪除失敗，請再試一次");
    }
  };

  const handleViewPhoto = (photoUrl: string, title: string) => {
    setLightboxPhoto(photoUrl);
    setLightboxTitle(title);
  };

  const handleExportCsv = async () => {
    try {
      const csvContent = await api.exportCsv(currentMonthStr);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `醫師薪資報表_${currentMonthStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      alert("匯出報表失敗");
    }
  };

  const handleLockVault = () => {
    lockVault();
    setIsUnlocked(false);
  };

  // If vault is locked, present Auth & Decryption Screen
  if (!isUnlocked) {
    return (
      <>
        <AuthScreen
          currentUser={currentUser}
          onUnlocked={handleVaultUnlocked}
          onOpenFirebaseConfig={() => setIsFirebaseConfigOpen(true)}
        />
        <FirebaseConfigModal
          isOpen={isFirebaseConfigOpen}
          onClose={() => setIsFirebaseConfigOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Bar */}
      <Header
        currentYear={currentYear}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        onOpenAddModal={handleOpenAddModal}
        onExportCsv={handleExportCsv}
        currentUser={currentUser}
        onLockVault={handleLockVault}
        onOpenSecurityModal={() => setIsSecurityOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <MonthlySummary summary={summary} loading={loading} />

        <RecordList
          records={records}
          loading={loading}
          onEdit={handleEditRecord}
          onDelete={handleDeleteRecord}
          onViewPhoto={handleViewPhoto}
          onAddClick={handleOpenAddModal}
        />
      </main>

      {/* Form Modal (Add / Edit) */}
      <RecordFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        recordToEdit={recordToEdit}
        defaultDate={`${currentMonthStr}-01`}
      />

      {/* Photo Lightbox */}
      <PhotoLightbox
        isOpen={!!lightboxPhoto}
        photoUrl={lightboxPhoto}
        title={lightboxTitle}
        onClose={() => setLightboxPhoto(null)}
      />

      {/* Security Modal */}
      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        currentUser={currentUser}
        onLocked={handleLockVault}
        onOpenFirebaseConfig={() => setIsFirebaseConfigOpen(true)}
        onImportSuccess={loadData}
      />

      {/* Firebase Config Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseConfigOpen}
        onClose={() => setIsFirebaseConfigOpen(false)}
      />
    </div>
  );
}

export default App;
