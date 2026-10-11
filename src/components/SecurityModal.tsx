import React, { useState } from "react";
import { User } from "firebase/auth";
import {
  lockVault,
  createVaultChallenge,
  encryptPayload,
} from "../lib/crypto";
import {
  saveVaultChallenge,
  uploadEncryptedRecord,
} from "../lib/firebase";
import { getMemoryRecords } from "../lib/tauri";
import {
  X,
  Shield,
  KeyRound,
  Download,
  Lock,
  Check,
  AlertCircle,
  Cloud,
} from "lucide-react";

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLocked: () => void;
  onOpenFirebaseConfig: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLocked,
  onOpenFirebaseConfig,
}) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  // Handle changing master password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("新主密碼長度請至少設定 6 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("兩次輸入的新密碼不一致");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      setMsg("");

      // 1. Create new challenge and derive new activeKey
      const newChallenge = await createVaultChallenge(newPassword);

      // 2. Re-encrypt all current memory records with the new key
      const currentRecords = getMemoryRecords();
      if (currentUser) {
        await saveVaultChallenge(currentUser.uid, newChallenge);
        for (const r of currentRecords) {
          const envelope = await encryptPayload(r);
          await uploadEncryptedRecord(currentUser.uid, r.id, envelope);
        }
      } else {
        localStorage.setItem("clinic_local_vault_challenge", JSON.stringify(newChallenge));
      }

      setMsg("主密碼已成功更新！所有薪資紀錄已使用新金鑰完成端對端重新加密。");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("變更密碼失敗: " + (err.message || "發生錯誤"));
    } finally {
      setLoading(false);
    }
  };

  // Export encrypted backup
  const handleExportBackup = async () => {
    try {
      const records = getMemoryRecords();
      const envelopes = [];
      for (const r of records) {
        const env = await encryptPayload(r);
        envelopes.push({ id: r.id, envelope: env });
      }

      const backupObj = {
        app: "clinic_md_income_e2ee",
        version: 1,
        exported_at: new Date().toISOString(),
        total_records: envelopes.length,
        data: envelopes,
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `醫師薪資記帳_加密備份_${new Date().toISOString().split("T")[0]}.enc.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("匯出備份失敗: " + err.message);
    }
  };

  const handleImmediateLock = () => {
    lockVault();
    onClose();
    onLocked();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">安全與隱私中心</h3>
              <p className="text-[11px] text-slate-500">金鑰管理、端對端加密與備份</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {msg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action 1: Change Master Password */}
          <form onSubmit={handleChangePassword} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-600" />
              變更主解密密碼
            </div>
            <p className="text-[11px] text-slate-500">
              變更後系統會自動以新金鑰重新加密並同步所有歷史紀錄。
            </p>
            <div>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="輸入新主密碼 (至少 6 碼)..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次確認新主密碼..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "重新加密資料中..." : "確認變更密碼"}
            </button>
          </form>

          {/* Action 2: Backup */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-teal-600" />
                匯出加密備份檔 (.enc.json)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                下載包含所有薪資單與相片的端對端加密備份包
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-3 py-2 text-xs font-bold text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded-xl transition-colors shadow-sm"
            >
              立即匯出
            </button>
          </div>

          {/* Action 3: Firebase Config */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-teal-600" />
              <span className="font-semibold text-slate-700">Firebase 雲端連線</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFirebaseConfig();
              }}
              className="text-xs font-medium text-teal-600 hover:underline"
            >
              檢視 / 變更設定
            </button>
          </div>

          {/* Action 4: Immediate Lock */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleImmediateLock}
              className="w-full py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              立即安全鎖定並清除記憶體金鑰
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
