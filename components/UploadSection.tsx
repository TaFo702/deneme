import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { analyzeImage } from '../services/geminiService';
import { PriceItem, AnalysisState } from '../types';

interface UploadSectionProps {
  onDataUpdate: (data: PriceItem[]) => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onDataUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<AnalysisState>({ isLoading: false, error: null });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setState({ isLoading: false, error: null });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!preview) return;

    setState({ isLoading: true, error: null });

    try {
      // Remove data URL prefix for API
      const base64Data = preview.split(',')[1];
      const mimeType = preview.split(';')[0].split(':')[1];
      
      const newData = await analyzeImage(base64Data, mimeType);
      onDataUpdate(newData);
      setState({ isLoading: false, error: null });
    } catch (err) {
      setState({ 
        isLoading: false, 
        error: "Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin veya API anahtarınızı kontrol edin." 
      });
    }
  };

  const handleReset = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setState({ isLoading: false, error: null });
  };

  return (
    <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 shadow-xl mb-8">
      <div className="flex flex-col md:flex-row items-start gap-6">
        
        {/* Left Side: Upload Controls */}
        <div className="w-full md:w-1/3 space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="text-primary-500" />
            Yeni Liste Yükle
          </h3>
          <p className="text-gray-400 text-sm">
            Fiyat listenizin fotoğrafını yükleyin, Yapay Zeka (Gemini 2.5) otomatik olarak tabloya dönüştürsün.
          </p>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          {!preview ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-secondary-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
            >
              <Upload className="mb-2 h-8 w-8" />
              <span className="text-sm">Resim Seçmek İçin Tıkla</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden border border-secondary-600 h-48 bg-black">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAnalyze}
                  disabled={state.isLoading}
                  className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg font-semibold shadow-lg shadow-primary-900/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.isLoading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5" />
                      Analiz Ediliyor...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      Listeyi Dönüştür
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={state.isLoading}
                  className="px-4 py-2 bg-secondary-700 text-white rounded-lg hover:bg-secondary-600 transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          )}
          
          {state.error && (
            <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg">
              {state.error}
            </div>
          )}
        </div>

        {/* Right Side: Instructions / Status */}
        <div className="flex-1 border-l border-secondary-700 pl-6 hidden md:block">
           <h4 className="text-primary-400 font-semibold mb-3">Nasıl Çalışır?</h4>
           <ul className="space-y-2 text-gray-400 text-sm">
             <li className="flex items-start gap-2">
               <span className="bg-secondary-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5">1</span>
               <span>Net ve okunabilir bir fiyat listesi fotoğrafı çekin veya seçin.</span>
             </li>
             <li className="flex items-start gap-2">
               <span className="bg-secondary-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5">2</span>
               <span>"Listeyi Dönüştür" butonuna basın.</span>
             </li>
             <li className="flex items-start gap-2">
               <span className="bg-secondary-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5">3</span>
               <span>Gemini AI görseli analiz eder ve aşağıdaki tabloyu günceller.</span>
             </li>
           </ul>

           <div className="mt-6 p-4 bg-primary-900/20 border border-primary-900/50 rounded-lg">
             <p className="text-primary-200 text-xs italic">
               * Not: Bu sistem Gemini 2.5 Flash modelini kullanır. En iyi sonuçlar için yüksek kontrastlı ve düz çekilmiş fotoğraflar kullanın.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UploadSection;