
import React, { useRef } from 'react';
import { Camera, Upload, Aperture } from 'lucide-react';
import { useScannerTranslation } from '../../i18n/scanner';

interface ScannerSourceSelectorProps {
  onCameraSelect: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ScannerSourceSelector: React.FC<ScannerSourceSelectorProps> = ({ onCameraSelect, onFileSelect }) => {
  const { t } = useScannerTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="text-center space-y-6 w-full max-w-sm">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500 shadow-xl border border-slate-700">
          <Camera size={40} />
        </div>
        <h3 className="text-xl font-bold text-white">{t('scan_source_title')}</h3>
        <div className="flex flex-col gap-4">
          <button
            onClick={onCameraSelect}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/50 active:scale-95 transition-all"
          >
            <Aperture size={24} /> <span className="text-lg">{t('scan_btn_camera')}</span>
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-950 px-2 text-slate-500">{t('scan_source_or')}</span></div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-3 border border-slate-600 active:scale-95 transition-all"
          >
            <Upload size={24} /> <span className="text-lg">{t('scan_btn_upload')}</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileSelect}
        />
        <p className="text-xs text-slate-500 mt-4">{t('scan_hint')}</p>
      </div>
    </div>
  );
};

export default ScannerSourceSelector;
