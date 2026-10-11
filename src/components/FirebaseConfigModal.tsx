import React, { useState, useEffect } from "react";
import { X, Cloud, Key, Check, HelpCircle } from "lucide-react";
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, FirebaseConfig } from "../lib/firebase";

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const [jsonInput, setJsonInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [projectId, setProjectId] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [messagingSenderId, setMessagingSenderId] = useState("");
  const [appId, setAppId] = useState("");
  const [mode, setMode] = useState<"paste" | "fields">("paste");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const current = getFirebaseConfig();
    if (current) {
      setApiKey(current.apiKey || "");
      setAuthDomain(current.authDomain || "");
      setProjectId(current.projectId || "");
      setStorageBucket(current.storageBucket || "");
      setMessagingSenderId(current.messagingSenderId || "");
      setAppId(current.appId || "");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseJson = () => {
    try {
      setErrorMsg("");
      let clean = jsonInput.trim();
      // Handle standard "const firebaseConfig = { ... }" snippet copied from Firebase Console
      if (clean.includes("{")) {
        const start = clean.indexOf("{");
        const end = clean.lastIndexOf("}") + 1;
        clean = clean.slice(start, end);
      }
      // Replace unquoted keys with quoted keys if needed
      clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      const parsed = JSON.parse(clean);

      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error("JSON 缺少必要的 apiKey 或 projectId 欄位");
      }

      saveFirebaseConfig({
        apiKey: parsed.apiKey,
        authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
        projectId: parsed.projectId,
        storageBucket: parsed.storageBucket || "",
        messagingSenderId: parsed.messagingSenderId || "",
        appId: parsed.appId || "",
      });
    } catch (err: any) {
      setErrorMsg(`解析失敗: ${err.message || "請確認貼上的 JSON 格式是否正確"}`);
    }
  };

  const handleSaveFields = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setErrorMsg("請至少填寫 API Key 與 Project ID");
      return;
    }

    const config: FirebaseConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveFirebaseConfig(config);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/50 to-emerald-50/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Google Firebase 雲端同步設定</h3>
              <p className="text-[11px] text-slate-500">跨裝置（手機/電腦）自動雲端即時同步</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Quick guide alert */}
          <div className="bg-teal-50/70 border border-teal-200/60 rounded-xl p-3.5 text-xs text-teal-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-teal-600" />
              如何取得 Firebase 設定？
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600 pl-1">
              <li>前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-teal-700 underline font-medium">Google Firebase Console</a> 建立免費專案。</li>
              <li>點擊「新增 Web 應用程式」複製 <code>firebaseConfig</code>。</li>
              <li>於「Authentication」啟用「Google 登入」，於「Firestore Database」建立資料庫。</li>
            </ol>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === "paste" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              直接貼上 Firebase Config JSON
            </button>
            <button
              type="button"
              onClick={() => setMode("fields")}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === "fields" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              手動填寫各項金鑰欄位
            </button>
          </div>

          {mode === "paste" ? (
            <div className="space-y-3">
              <textarea
                rows={6}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={'貼上範例：\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-app.firebaseapp.com",\n  projectId: "my-app",\n  appId: "1:..."\n};'}
                className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <button
                type="button"
                onClick={handleParseJson}
                className="w-full py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                解析並儲存設定
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveFields} className="space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">API Key *</label>
                <input
                  type="text"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Project ID *</label>
                <input
                  type="text"
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-clinic-app"
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Auth Domain</label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="my-clinic-app.firebaseapp.com"
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">App ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:12345:web:67890"
                  className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Key className="w-4 h-4" />
                儲存設定
              </button>
            </form>
          )}

          {/* Reset button */}
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("確定要重設並清除已儲存的 Firebase 設定嗎？")) {
                  clearFirebaseConfig();
                }
              }}
              className="text-slate-400 hover:text-rose-600 transition-colors"
            >
              清除現有設定
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
