import React, { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

interface PhotoLightboxProps {
  isOpen: boolean;
  photoUrl: string | null;
  title?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  isOpen,
  photoUrl,
  title,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !photoUrl) return null;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = photoUrl;
    link.download = `clinic_receipt_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-between p-4 transition-all animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white/90 py-2">
        <div className="text-sm font-semibold truncate">
          {title || "憑證相片預覽"}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="縮小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="順時針旋轉90度"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="下載原圖"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/20 hover:bg-rose-600 transition-colors ml-2"
            title="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Display Area */}
      <div
        className="flex-1 flex items-center justify-center w-full overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photoUrl}
          alt="Receipt detail"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.2s ease-out",
          }}
          className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bottom Hint */}
      <div className="text-xs text-white/50 pb-2">
        點擊背景任意處或右上角按鈕即可關閉
      </div>
    </div>
  );
};
