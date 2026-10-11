import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  loginWithGoogle,
  logoutUser,
  fetchVaultChallenge,
  saveVaultChallenge,
  getFirebaseConfig,
} from "../lib/firebase";
import {
  createVaultChallenge,
  unlockVaultWithChallenge,
  VaultChallenge,
} from "../lib/crypto";
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Settings,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";


interface AuthScreenProps {
  currentUser: User | null;
  onUnlocked: (user: User | null) => void;
  onOpenFirebaseConfig: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentUser,
  onUnlocked,
  onOpenFirebaseConfig,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [vaultChallenge, setVaultChallenge] = useState<VaultChallenge | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isConfigured = !!getFirebaseConfig();

  // Load vault challenge when user logs in or switches to demo mode
  useEffect(() => {
    async function loadChallenge() {
      setErrorMsg("");
      setPassword("");
      setConfirmPassword("");

      if (currentUser) {
        setLoading(true);
        try {
          const ch = await fetchVaultChallenge(currentUser.uid);
          if (ch) {
            setVaultChallenge(ch);
            setIsNewUser(false);
          } else {
            setVaultChallenge(null);
            setIsNewUser(true);
          }
        } catch (err: any) {
          console.error(err);
          setErrorMsg("載入金鑰庫資訊失敗，請檢查網路連線");
        } finally {
          setLoading(false);
        }
      } else if (isDemoMode) {
        // Local mode fallback challenge
        const localCh = localStorage.getItem("clinic_local_vault_challenge");
        if (localCh) {
          setVaultChallenge(JSON.parse(localCh));
          setIsNewUser(false);
        } else {
          setVaultChallenge(null);
          setIsNewUser(true);
        }
      }
    }

    loadChallenge();
  }, [currentUser, isDemoMode]);

  // Handle Google Sign-In
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Google 登入失敗，請確認已啟用 Google 登入提供者");
    } finally {
      setLoading(false);
    }
  };

  // Handle Initializing Master Password (New User)
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMsg("為保障薪資隱私安全，主密碼長度請至少設定 6 個字元");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("兩次輸入的密碼不一致，請再次確認");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      const challenge = await createVaultChallenge(password);

      if (currentUser) {
        await saveVaultChallenge(currentUser.uid, challenge);
      } else {
        localStorage.setItem("clinic_local_vault_challenge", JSON.stringify(challenge));
      }

      setVaultChallenge(challenge);
      setIsNewUser(false);
      onUnlocked(currentUser);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("建立加密金鑰庫失敗，請重試");
    } finally {
      setLoading(false);
    }
  };

  // Handle Unlocking with Existing Password
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("請輸入主解密密碼");
      return;
    }
    if (!vaultChallenge) {
      setErrorMsg("尚未找到金鑰庫挑戰資訊");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      const ok = await unlockVaultWithChallenge(password, vaultChallenge);
      if (ok) {
        onUnlocked(currentUser);
      } else {
        setErrorMsg("主密碼不正確，無法解密金鑰庫！請確認後重新輸入。");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("解密失敗: " + (err.message || "密碼錯誤"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex flex-col items-center justify-center p-4 selection:bg-teal-500 selection:text-white">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 space-y-6 animate-in fade-in zoom-in duration-300">
        {/* App Title & Medical Shield Icon */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 mx-auto flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            受雇醫師收入記帳系統
          </h1>
          <p className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200/60 rounded-full px-3 py-1 inline-block">
            Google Firebase 雲端同步 + 本地端對端 AES-256 加密
          </p>
        </div>

        {/* Security Assurance Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-[11px] text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            零知識端對端隱私保證 (Zero-Knowledge)
          </div>
          <p className="leading-relaxed">
            所有薪資數字、兼診院所名單與薪資單照片，在離開裝置前皆已在本地加密為亂碼。<strong>Google 雲端僅存放密文，任何人（含 Google 官方）皆無從得知您的真實所得</strong>。
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── STEP 1: Google Authentication (if not logged in & not demo) ── */}
        {!currentUser && !isDemoMode && (
          <div className="space-y-4 pt-2">
            {!isConfigured ? (
              <div className="text-center space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  <p className="font-bold mb-1">尚未連結 Google Firebase 專案</p>
                  <p className="text-[11px] text-slate-600">
                    請點擊下方按鈕貼上您的 Firebase Config，即可啟用 Google 帳號一鍵登入與跨裝置雲端同步。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenFirebaseConfig}
                  className="w-full py-3 px-4 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  設定 Firebase 雲端同步金鑰
                </button>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center text-[10px] text-slate-400 uppercase"><span className="bg-white px-2">或者</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoMode(true)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  進入「本機端對端加密展示模式」試用
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="w-full py-3.5 px-4 bg-white border border-slate-300 hover:border-teal-500 hover:bg-slate-50 text-slate-800 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  {loading ? "連線登入中..." : "以 Google 帳號安全登入"}
                </button>
                <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={onOpenFirebaseConfig}
                    className="text-teal-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    修改 Firebase 設定
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDemoMode(true)}
                    className="hover:underline text-slate-400"
                  >
                    離線試用模式
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Master Password E2EE Setup or Unlock ── */}
        {(currentUser || isDemoMode) && (
          <div className="space-y-4">
            {/* User identification badge */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                    MD
                  </div>
                )}
                <div className="text-xs truncate">
                  <p className="font-bold text-slate-800 truncate">
                    {currentUser?.displayName || (isDemoMode ? "本機離線醫師" : "醫師會員")}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {currentUser?.email || "Local E2EE Vault"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (currentUser) logoutUser();
                  setIsDemoMode(false);
                }}
                className="text-[11px] text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors font-semibold"
              >
                切換帳號
              </button>
            </div>

            {/* Mode A: Setup Master Password (First-Time) */}
            {isNewUser ? (
              <form onSubmit={handleSetupPassword} className="space-y-3.5">
                <div className="text-center">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-teal-600" />
                    初次使用：請設定您的解密主密碼
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    此密碼為您的個人專屬金鑰，連 Google 官方也無法得知，請務必牢記。
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    設定主密碼 (至少 6 碼) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="請輸入主密碼..."
                      className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    再次確認主密碼 *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次輸入主密碼..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? "正在初始化端對端金鑰庫..." : "確認並建立專屬金鑰庫"}
                </button>
              </form>
            ) : (
              /* Mode B: Unlock Existing Vault */
              <form onSubmit={handleUnlock} className="space-y-3.5">
                <div className="text-center">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                    <Lock className="w-4 h-4 text-teal-600" />
                    解鎖您的薪資記帳簿
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    輸入主密碼以解密您的發薪診所名冊與收入紀錄
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    主解密密碼 *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="請輸入主密碼..."
                      className="w-full px-3.5 py-2.5 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md shadow-teal-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  {loading ? "正在解密中..." : "驗證密碼並解鎖記帳簿"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>AES-GCM-256 + PBKDF2</span>
          <span>受雇醫師收入管理 v0.2.0</span>
        </div>
      </div>
    </div>
  );
};
