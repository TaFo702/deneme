import React, { useState, useEffect } from 'react';
import { INITIAL_DATA } from './constants';
import { PriceItem } from './types';
import PriceList from './components/PriceList';
import PriceCalculator from './components/PriceCalculator';
import { Printer, Phone, ArrowUp, Globe, MessageCircle, Calculator } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<PriceItem[]>(INITIAL_DATA);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Handle scroll visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-secondary-50 font-sans text-secondary-800 selection:bg-primary-500 selection:text-white flex flex-col relative">
      
      {/* STICKY HEADER CONTAINER (Holds both Top Bar and Main Header) */}
      <div className="sticky top-0 z-50 w-full shadow-xl">
        
        {/* TOP BAR - Web Site Link */}
        <div className="bg-secondary-950 text-secondary-400 py-2 border-b border-secondary-800 text-xs font-medium">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
             <span className="hidden sm:inline">Türkiye'nin En Uygun Fiyatlı Online Matbaası</span>
             <span className="sm:hidden">Kolay Basım Online Matbaa</span>
             <a 
               href="https://www.kolaybasim.com" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="flex items-center gap-1.5 text-primary-500 font-black tracking-wider hover:text-white transition-colors animate-pulse"
             >
                <Globe className="h-3 w-3" />
                <span>www.kolaybasim.com</span>
             </a>
          </div>
        </div>

        {/* Header */}
        <header className="bg-secondary-900 border-b-4 border-primary-500">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            
            {/* Left Side: Logo (Fully Clickable) */}
            <a 
              href="https://www.kolaybasim.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-3 relative z-10 group cursor-pointer"
            >
              <div className="bg-primary-500 p-2.5 rounded-lg shadow-lg shadow-primary-500/20 transform group-hover:scale-105 transition-transform duration-200">
                <Printer className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white leading-none group-hover:text-primary-100 transition-colors">
                  KOLAY<span className="text-primary-500 group-hover:text-white transition-colors">BASIM</span>
                </h1>
                <p className="text-[10px] md:text-xs text-secondary-400 tracking-wide uppercase font-bold mt-1 group-hover:text-white transition-colors">En Uygun Fiyatlar</p>
              </div>
            </a>
            
            {/* Center: Main Title (Absolute Positioned) */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-md whitespace-nowrap">
                MATBAA FİYAT LİSTESİ
              </h2>
            </div>
            
            {/* Right Side: Phone Only */}
            <div className="hidden md:flex items-center gap-8 relative z-10">
              {/* WhatsApp / Phone */}
              <a 
                href="https://wa.me/905517242526?text=Merhaba,%20fiyat%20listesi%20hakkında%20bilgi%20almak%20istiyorum."
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-end group hover:opacity-90 transition-opacity"
              >
                  <span className="text-xs text-primary-500 font-bold uppercase tracking-wider mb-0.5 group-hover:text-primary-400 transition-colors flex items-center gap-1">
                     Müşteri Hizmetleri
                  </span>
                  <div className="flex items-center gap-2 text-white">
                    <Phone className="h-4 w-4 text-primary-500 group-hover:text-primary-400 transition-colors" />
                    <span className="text-xl font-bold tracking-tight">0551 724 25 26</span>
                  </div>
              </a>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow">
        
        {/* Price Calculator Modal - Conditionally Rendered to fix Hook Error #310 */}
        {showCalculator && (
          <PriceCalculator 
             data={data} 
             isOpen={showCalculator} 
             onClose={() => setShowCalculator(false)} 
          />
        )}
        
        {/* Existing Price List */}
        <PriceList data={data} />
      </main>

      {/* Footer */}
      <footer className="bg-secondary-900 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
           <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary-500" />
                <span className="font-bold text-lg">KOLAY BASIM</span>
              </div>
              
              <div className="flex gap-6 text-sm font-medium text-secondary-400">
                 <a href="https://www.kolaybasim.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">www.kolaybasim.com</a>
              </div>

              <p className="text-secondary-400 text-sm">
                &copy; 2025 Tüm hakları saklıdır.
              </p>
           </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button (Bottom Right) */}
      <a
        href="https://wa.me/905517242526?text=Merhaba,%20sipariş%20vermek%20istiyorum."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white px-4 py-3.5 rounded-full shadow-xl shadow-green-500/30 hover:bg-[#20bd5a] hover:scale-105 transition-all duration-300 group"
        aria-label="WhatsApp Destek"
      >
        <MessageCircle className="h-6 w-6 fill-current" />
        <span className="font-bold pr-1 hidden md:block">Canlı Destek</span>
      </a>

      {/* Calculator Floating Button (Above WhatsApp) */}
      <button
        onClick={() => setShowCalculator(true)}
        className="fixed bottom-24 right-6 z-40 flex items-center gap-2 bg-secondary-800 text-white px-4 py-3 rounded-full shadow-xl shadow-secondary-900/40 hover:bg-secondary-700 hover:scale-105 transition-all duration-300 border-2 border-primary-500 group"
      >
        <Calculator className="h-5 w-5 text-primary-500 group-hover:text-white transition-colors" />
        <span className="font-bold text-sm hidden md:block">Fiyat Hesapla</span>
      </button>

      {/* Scroll to Top Button (Stacked above Calculator) */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-40 right-6 z-30 p-2.5 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-all duration-300 transform ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        aria-label="Yukarı Çık"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
};

export default App;