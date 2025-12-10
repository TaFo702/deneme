import React, { useState, useMemo, useEffect } from 'react';
import { PriceItem } from '../types';
import { Calculator, AlertCircle, CheckCircle2, Scissors, X, TrendingUp, TrendingDown, Package, Lightbulb, ArrowRight, Sparkles, Zap, Ruler, Info, Percent, AlertTriangle, Star } from 'lucide-react';

interface PriceCalculatorProps {
  data: PriceItem[];
  isOpen: boolean;
  onClose: () => void;
}

interface CalculationResult {
  paperName: string;
  strategy: 'formula' | 'multiplier' | 'standard';
  matchItem: PriceItem; // The raw item used for base calculation
  calculatedPrice: number;
  formattedPrice: string;
  isExact: boolean;
  needsCut: boolean;
  details: any;
  baseDims?: { w: number, h: number }; // The standard size used
  // Suggestions
  prevQty?: { qty: number; price: string };
  nextQty?: { qty: number; price: string };
  // Size Suggestion
  sizeSuggestion?: {
      w_mm: number;
      h_mm: number;
      price: number;
      formattedPrice: string;
      savingAmount: string;
      savingPercent: number; // Added percentage
      isSamePrice: boolean; // New flag to detect equal price but better fit
      wasteAmt?: string; // Amount of difference/waste
  };
}

const PriceCalculator: React.FC<PriceCalculatorProps> = ({ data, isOpen, onClose }) => {
  const [width, setWidth] = useState<string>(''); // in MM
  const [height, setHeight] = useState<string>(''); // in MM
  const [category, setCategory] = useState<string>('Broşür');
  const [quantity, setQuantity] = useState<string>('1000');
  
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Categories that use the Multiplier/Cut logic (Strategy 1)
  const MULTIPLIER_CATEGORIES = ['Kartvizit', 'Broşür', 'El İlanı', 'Etiket', 'Magnet', '200 Gr. Kuşe'];

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>(
      data
        .map(item => item.kategori)
        .filter(cat => {
            const lowerCat = cat.trim().toLocaleLowerCase('tr');
            return !lowerCat.includes('zarf') && 
                   !lowerCat.includes('bloknot') && 
                   !lowerCat.includes('dosya') && 
                   !lowerCat.includes('oto paspas') &&
                   !lowerCat.includes('amerikan servis') &&
                   !lowerCat.includes('karton çanta') &&
                   !lowerCat.includes('antetli') && 
                   !lowerCat.includes('afiş');
        })
    );
    
    // Custom sort order - Swapped Etiket and 200 Gr. Kuşe as requested
    const sortOrder = ['Broşür', 'Kartvizit', 'Magnet', 'El İlanı', 'Etiket', '200 Gr. Kuşe'];
    
    return Array.from(cats).sort((a, b) => {
        const indexA = sortOrder.indexOf(a);
        const indexB = sortOrder.indexOf(b);
        
        // If both are in the explicit list, sort by list index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        
        // If one is in list, it comes first
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        // Otherwise alphabetical
        return a.localeCompare(b, 'tr');
    });
  }, [data]);

  // Standard Quantities for Dropdown
  const QUANTITY_OPTIONS = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 20000];

  const parsePrice = (priceStr: string) => {
    return parseFloat(priceStr.replace(/\./g, '').replace(/[^\d,]/g, '').replace(',', '.'));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(price);
  };

  const parseSize = (sizeStr: string) => {
    const clean = sizeStr.toLowerCase().replace(/\s/g, '').replace('cm', '');
    const match = clean.match(/^([\d.]+)[x*]([\d.]+)/);
    if (match) {
      return { w: parseFloat(match[1]), h: parseFloat(match[2]) };
    }
    return null;
  };

  // Helper: Clean description to group by "Paper Type"
  const getPaperTypeGroup = (desc: string, cat: string) => {
     if (cat === 'Magnet') return 'Magnet'; 
     const parts = desc.split('-');
     return parts[0].trim();
  };

  // Core Calculation Function for a single item + user inputs
  const calculatePriceForItem = (item: PriceItem, userW_mm: number, userH_mm: number, targetQty: number) => {
    const userW_cm = userW_mm / 10;
    const userH_cm = userH_mm / 10;
    
    // 1. Magnet Formula
    if (item.kategori === 'Magnet' && item.kod === 'MGN') {
        const basePrice = userW_mm * userH_mm * 0.21;
        const total = basePrice * (targetQty / 1000); 
        return {
            price: total,
            strategy: 'formula',
            needsCut: true,
            details: { userW_mm, userH_mm }
        };
    }

    // 2. Multiplier / Cut Logic
    if (MULTIPLIER_CATEGORIES.includes(item.kategori)) {
        // Determine Base Size
        let BASE_W = 0;
        let BASE_H = 0;
        
        if (item.kategori === 'Kartvizit' || item.kategori === 'Etiket') {
            BASE_W = 8.6;
            BASE_H = 5.4;
        } else {
            const s = parseSize(item.ebat);
            if (s) {
                BASE_W = s.w;
                BASE_H = s.h;
            }
        }

        if (BASE_W === 0 || BASE_H === 0) return null;

        // Quantity Ratio (Target / ItemQty)
        const itemQty = parseInt(item.miktar.replace(/[^\d]/g, '')) || 1000;
        const qtyRatio = targetQty / itemQty;

        // Standard Imposition Check
        const userW_mm_chk = userW_mm;
        const userH_mm_chk = userH_mm;
        const baseW_mm = BASE_W * 10;
        const baseH_mm = BASE_H * 10;
        
        // Strict Tolerance (0.5mm) for the initial calculation. 
        // We set this low so that 1mm difference (201 vs 200) is counted as Custom/Expensive.
        const TOLERANCE = 0.5;

        const checkFit = (u: number, b: number) => {
             const r = u/b;
             const round = Math.round(r);
             return Math.abs(r - round) * b <= TOLERANCE; 
        }

        let isStandardImposition = false;
        let imposedMultiplier = 0;

        // Check Orientation 1
        if (checkFit(userW_mm_chk, baseW_mm) && checkFit(userH_mm_chk, baseH_mm)) {
             isStandardImposition = true;
             const rW = Math.max(1, Math.round(userW_mm_chk / baseW_mm));
             const rH = Math.max(1, Math.round(userH_mm_chk / baseH_mm));
             imposedMultiplier = rW * rH;
        } 
        // Check Orientation 2
        else if (checkFit(userW_mm_chk, baseH_mm) && checkFit(userH_mm_chk, baseW_mm)) {
             isStandardImposition = true;
             const rW = Math.max(1, Math.round(userW_mm_chk / baseH_mm));
             const rH = Math.max(1, Math.round(userH_mm_chk / baseW_mm));
             imposedMultiplier = rW * rH;
        }

        let multiplier = 0;

        if (isStandardImposition) {
             // Standard multiple fitting (e.g. A4 fits exactly twice in A3)
             multiplier = Math.ceil(imposedMultiplier * qtyRatio);
        } else {
             // Custom fit logic (Linear Ceiling) with Optimization for Quantity Ratio
             // Instead of simply calculating molds per unit and multiplying by ratio,
             // we simulate arranging the total items (ratio) into a layout (e.g. 1x2, 2x1, 2x2)
             // to find the most efficient mold usage.
             
             let bestTotalMolds = Number.MAX_VALUE;
             const ratioInt = Math.ceil(qtyRatio);
             
             // Find factors of ratioInt (e.g. 2 -> [1,2], 4 -> [1,4], [2,2])
             const layouts = [];
             for(let i=1; i<=Math.sqrt(ratioInt); i++) {
                 if(ratioInt % i === 0) {
                     layouts.push({r: i, c: ratioInt/i});
                 }
             }

             for (const {r, c} of layouts) {
                 // Try Layout 1: r rows, c cols
                 // Total dimensions for this layout
                 const totalW1 = userW_mm * c;
                 const totalH1 = userH_mm * r;
                 
                 // Check against base (Normal & Rotated)
                 const m1 = Math.ceil(totalW1 / baseW_mm) * Math.ceil(totalH1 / baseH_mm);
                 const m2 = Math.ceil(totalW1 / baseH_mm) * Math.ceil(totalH1 / baseW_mm);
                 
                 // Try Layout 2: c rows, r cols (Swap)
                 const totalW2 = userW_mm * r;
                 const totalH2 = userH_mm * c;
                 const m3 = Math.ceil(totalW2 / baseW_mm) * Math.ceil(totalH2 / baseH_mm);
                 const m4 = Math.ceil(totalW2 / baseH_mm) * Math.ceil(totalH2 / baseW_mm);
 
                 bestTotalMolds = Math.min(bestTotalMolds, m1, m2, m3, m4);
             }
             
             multiplier = bestTotalMolds;
        }
        
        const basePrice = parsePrice(item.fiyat);
        
        return {
            price: basePrice * multiplier,
            strategy: 'multiplier',
            needsCut: !isStandardImposition,
            details: { multiplier, qtyRatio },
            baseDims: { w: baseW_mm, h: baseH_mm }
        };
    }

    return null; 
  };

  const handleCalculate = () => {
    setResults([]);
    setError(null);

    const w_mm = parseFloat(width.replace(',', '.'));
    const h_mm = parseFloat(height.replace(',', '.'));
    const targetQty = parseInt(quantity);

    if (!w_mm || !h_mm || !targetQty) {
        setError("Lütfen geçerli ebat ve adet giriniz.");
        return;
    }

    // 1. Filter items by Category
    const categoryItems = data.filter(i => i.kategori === category);

    // 2. Group by Paper Type
    const groups: Record<string, PriceItem[]> = {};
    
    categoryItems.forEach(item => {
        let groupKey = getPaperTypeGroup(item.aciklama, category);
        if (category === 'Magnet') {
            if (item.kod !== 'MGN') return; 
            groupKey = 'Özel Ebat Magnet';
        }
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
    });

    const calculatedResults: CalculationResult[] = [];

    // 3. Iterate Groups and Calculate
    Object.entries(groups).forEach(([paperName, items]) => {
        
        // DETERMINE CANDIDATE ITEMS FOR CALCULATION
        // We now iterate through ALL items in the group (e.g., both 1000 and 2000 qty items)
        // to find the most cost-effective configuration.
        // This allows logic like fitting 2000 items onto 1000 sheets (2-up) if cheaper.
        const candidateItems: PriceItem[] = items;

        // Find the BEST PRICE among all candidates
        let bestResult: { res: any; item: PriceItem } | null = null;

        for (const candidate of candidateItems) {
            const res = calculatePriceForItem(candidate, w_mm, h_mm, targetQty);
            if (res) {
                if (!bestResult || res.price < bestResult.res.price) {
                    bestResult = { res, item: candidate };
                }
            }
        }

        if (!bestResult) return;

        const { res: calcResult, item: matchedItem } = bestResult;

        // --- Suggestion Logic for Alternative Size (Smart Snap) ---
        let sizeSuggestion = undefined;
        if (category !== 'Magnet') { 
            
            const distinctSizes = new Set<string>(items.map(i => i.ebat));
            const currentPrice = calcResult.price;
            let bestSuggestion: any = undefined;
            const SNAP_TOLERANCE = 10; // 10mm tolerance for searching suggestions (1cm)

            distinctSizes.forEach(sStr => {
                 // Find best item for this size & targetQty to get accurate price
                 const sizeItems = items.filter(i => i.ebat === sStr);
                 let itemToUse = sizeItems.find(i => parseInt(i.miktar.replace(/[^\d]/g, '')) === targetQty);
                 if (!itemToUse) {
                     itemToUse = sizeItems.find(i => parseInt(i.miktar.replace(/[^\d]/g, '')) === 1000) || sizeItems[0];
                 }
                 if (!itemToUse) return;

                 // Determine base dims
                 let baseW = 0; 
                 let baseH = 0;
                 
                 if (category === 'Kartvizit' || category === 'Etiket') {
                     baseW = 86; baseH = 54;
                 } else {
                     const s = parseSize(itemToUse.ebat);
                     if (s) { baseW = s.w * 10; baseH = s.h * 10; }
                 }
                 if (baseW === 0 || baseH === 0) return;

                 const checkSnap = (targetW: number, targetH: number) => {
                    const multW = Math.max(1, Math.round(targetW / baseW));
                    const multH = Math.max(1, Math.round(targetH / baseH));
                    
                    const snapW = multW * baseW;
                    const snapH = multH * baseH;
                    
                    // Tolerance check (Range: target ± 10mm)
                    if (Math.abs(targetW - snapW) <= SNAP_TOLERANCE && 
                        Math.abs(targetH - snapH) <= SNAP_TOLERANCE) {
                        
                        // Suggest if difference is significant enough (e.g. >= 0.5mm)
                        // This ensures even 1mm diffs (201 vs 200) trigger the suggestion
                        if (Math.abs(targetW - snapW) >= 0.5 || Math.abs(targetH - snapH) >= 0.5) {
                            return { w: snapW, h: snapH };
                        }
                    }
                    return null;
                 };

                 // Direct Orientation Snap
                 const snapDirect = checkSnap(w_mm, h_mm);
                 
                 const evaluateSuggestion = (w: number, h: number) => {
                    const res = calculatePriceForItem(itemToUse!, w, h, targetQty);
                    if (res) {
                         const isCheaper = res.price < currentPrice;
                         const isSamePriceButStandard = (res.price === currentPrice && calcResult.needsCut && !res.needsCut);

                         if (isCheaper || isSamePriceButStandard) {
                             if (!bestSuggestion || res.price <= bestSuggestion.price) {
                                 // Calculate Waste (Fire)
                                 const diffW = Math.abs(w_mm - w);
                                 const diffH = Math.abs(h_mm - h);
                                 let wasteStr = "";
                                 if (diffW >= 0.1 && diffH >= 0.1) wasteStr = `${parseFloat(diffW.toFixed(1))}x${parseFloat(diffH.toFixed(1))} mm`;
                                 else if (diffW >= 0.1) wasteStr = `${parseFloat(diffW.toFixed(1))} mm`;
                                 else if (diffH >= 0.1) wasteStr = `${parseFloat(diffH.toFixed(1))} mm`;
                                 
                                 // Calculate Percentage Savings
                                 const percent = isCheaper ? Math.round(((currentPrice - res.price) / currentPrice) * 100) : 0;

                                 bestSuggestion = {
                                     w_mm: w,
                                     h_mm: h,
                                     price: res.price,
                                     formattedPrice: formatPrice(res.price),
                                     savingAmount: formatPrice(currentPrice - res.price),
                                     savingPercent: percent,
                                     isSamePrice: isSamePriceButStandard,
                                     wasteAmt: wasteStr
                                 };
                             }
                         }
                    }
                 };

                 if (snapDirect) {
                    evaluateSuggestion(snapDirect.w, snapDirect.h);
                 }

                 // Rotated Orientation Snap
                 const multW_rot = Math.max(1, Math.round(w_mm / baseH)); 
                 const multH_rot = Math.max(1, Math.round(h_mm / baseW)); 
                 const snapW_rot = multW_rot * baseH;
                 const snapH_rot = multH_rot * baseW;
                 
                 // Check rotation snap
                 if (Math.abs(w_mm - snapW_rot) <= SNAP_TOLERANCE && 
                     Math.abs(h_mm - snapH_rot) <= SNAP_TOLERANCE) {
                      if (Math.abs(w_mm - snapW_rot) >= 0.5 || Math.abs(h_mm - snapH_rot) >= 0.5) {
                          evaluateSuggestion(snapW_rot, snapH_rot);
                      }
                 }
            });

            // Set suggestion if found
            if (bestSuggestion) {
                sizeSuggestion = bestSuggestion;
            }
        }

        // Calculate Quantity Suggestions (Prev/Next)
        let prevQtyRes = null;
        let nextQtyRes = null;
        const currentQtyIdx = QUANTITY_OPTIONS.indexOf(targetQty);
        
        const findBestPriceForQty = (targetQ: number) => {
             const qItems = items.filter(i => parseInt(i.miktar.replace(/[^\d]/g, '')) === targetQ);
             const qCandidates = qItems.length > 0 ? qItems : items.filter(i => parseInt(i.miktar.replace(/[^\d]/g, '')) === 1000);
             if (qCandidates.length === 0 && items.length > 0) qCandidates.push(items[0]);

             let bestP = Number.MAX_VALUE;
             let found = false;

             for (const cand of qCandidates) {
                 const r = calculatePriceForItem(cand, w_mm, h_mm, targetQ);
                 if (r && r.price < bestP) {
                     bestP = r.price;
                     found = true;
                 }
             }
             return found ? bestP : null;
        };

        // Prev Qty
        if (currentQtyIdx > 0) {
            const pQty = QUANTITY_OPTIONS[currentQtyIdx - 1];
            const pPrice = findBestPriceForQty(pQty);
            if (pPrice !== null) prevQtyRes = { qty: pQty, price: formatPrice(pPrice) };
        }

        // Next Qty
        if (currentQtyIdx < QUANTITY_OPTIONS.length - 1) {
            let nQty = QUANTITY_OPTIONS[currentQtyIdx + 1];
            if (targetQty === 2000 && nQty === 3000) {
                 if (QUANTITY_OPTIONS.includes(4000)) nQty = 4000;
            }
            const nPrice = findBestPriceForQty(nQty);
            if (nPrice !== null) nextQtyRes = { qty: nQty, price: formatPrice(nPrice) };
        }

        calculatedResults.push({
            paperName: paperName,
            strategy: calcResult.strategy as any,
            matchItem: matchedItem, // The item that provided the best price
            calculatedPrice: calcResult.price,
            formattedPrice: formatPrice(calcResult.price),
            needsCut: calcResult.needsCut,
            isExact: !calcResult.needsCut,
            details: calcResult.details,
            baseDims: calcResult.baseDims,
            prevQty: prevQtyRes || undefined,
            nextQty: nextQtyRes || undefined,
            sizeSuggestion: sizeSuggestion
        });
    });

    if (calculatedResults.length === 0) {
        setError("Bu kriterlere uygun sonuç bulunamadı. Lütfen ebat veya adet değiştirin.");
    } else {
        calculatedResults.sort((a, b) => {
            // Priority Sort: 115 gr Broşür at top
            const isAPrio = a.matchItem.kategori === 'Broşür' && a.paperName.includes('115');
            const isBPrio = b.matchItem.kategori === 'Broşür' && b.paperName.includes('115');
            
            if (isAPrio && !isBPrio) return -1;
            if (!isAPrio && isBPrio) return 1;

            return a.calculatedPrice - b.calculatedPrice;
        });
        setResults(calculatedResults);
    }
  };

  if (!isOpen) return null; 

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden relative flex flex-col max-h-[90vh]">
            
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-black/10 rounded-full text-white transition-colors"
            >
                <X className="h-6 w-6" />
            </button>

            {/* Header */}
            <div className="bg-secondary-900 p-6 flex items-center gap-4 border-b-4 border-primary-500 shrink-0">
                <div className="bg-primary-500 p-3 rounded-xl text-white shadow-lg shadow-primary-500/20">
                    <Calculator className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-2xl tracking-tight">Akıllı Fiyat Hesapla</h3>
                    <p className="text-secondary-400 text-sm">Ölçü ve adet girin, tüm kağıt seçeneklerini karşılaştırın.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row h-full overflow-hidden">
                
                {/* Left: Inputs */}
                <div className="w-full md:w-1/3 bg-secondary-50 p-6 md:p-8 border-r border-secondary-200 overflow-y-auto">
                    <div className="space-y-6">
                        
                        {/* Size Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-secondary-500 uppercase tracking-wide flex items-center gap-1">
                                    En <span className="text-[10px] text-secondary-400 normal-case">(mm)</span>
                                </label>
                                <input 
                                    type="number" 
                                    placeholder="86" 
                                    className="w-full p-3 border border-secondary-300 rounded-xl outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 font-black text-xl text-center text-secondary-900 transition-all"
                                    value={width}
                                    onChange={(e) => setWidth(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-secondary-500 uppercase tracking-wide flex items-center gap-1">
                                    Boy <span className="text-[10px] text-secondary-400 normal-case">(mm)</span>
                                </label>
                                <input 
                                    type="number" 
                                    placeholder="54" 
                                    className="w-full p-3 border border-secondary-300 rounded-xl outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 font-black text-xl text-center text-secondary-900 transition-all"
                                    value={height}
                                    onChange={(e) => setHeight(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Ürün Grubu</label>
                            <select 
                                className="w-full p-3 bg-white border border-secondary-300 rounded-xl font-bold text-secondary-900 focus:border-primary-500 outline-none cursor-pointer"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Quantity */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Adet</label>
                            <select 
                                className="w-full p-3 bg-white border border-secondary-300 rounded-xl font-bold text-secondary-900 focus:border-primary-500 outline-none cursor-pointer"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            >
                                {QUANTITY_OPTIONS.map(q => (
                                    <option key={q} value={q}>{q.toLocaleString('tr-TR')} Adet</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={handleCalculate}
                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-primary-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
                        >
                            <Calculator className="h-6 w-6" />
                            HESAPLA
                        </button>
                    </div>
                </div>

                {/* Right: Results */}
                <div className="flex-1 bg-white p-6 md:p-8 overflow-y-auto custom-scrollbar relative">
                    
                    {!error && results.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary-300 pointer-events-none p-8 text-center">
                            <Package className="h-24 w-24 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-secondary-400">Ölçüleri girin, sizin için en uygun seçenekleri bulalım.</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center text-center text-red-800 gap-2 animate-fade-in">
                            <AlertCircle className="h-10 w-10 text-red-500" />
                            <span className="font-bold text-lg">Hata</span>
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        {results.map((res, idx) => (
                            <div key={idx} className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group animate-fade-in-up ${idx === 0 ? 'border-primary-500 ring-2 ring-primary-100 relative' : 'border-secondary-200'}`} style={{animationDelay: `${idx * 100}ms`}}>
                                
                                {/* Card Header / Main Info */}
                                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                                    {/* Left: Paper Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2 pt-2 sm:pt-0">
                                            <span className="bg-secondary-900 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm font-mono tracking-wide">
                                                KOD: {res.matchItem.kod}
                                            </span>
                                            {res.needsCut ? (
                                                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200 flex items-center gap-1" title="Özel Kesim / Baskı Kalıbı">
                                                    <Scissors className="h-3 w-3" />
                                                    ÖZEL KESİM (MALİYETLİ)
                                                </span>
                                            ) : (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    STANDART EBAT (EKONOMİK)
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-black text-lg text-secondary-900 leading-tight mb-1">
                                            {res.paperName}
                                        </h4>
                                        
                                        {/* Added Price Impact Info */}
                                        <div className="mb-2">
                                            {!res.needsCut && (
                                                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Tam kalıp (Ek kesim maliyeti yok)
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-secondary-500 font-medium flex-wrap">
                                           <span>{width}x{height} mm</span>
                                           <span>•</span>
                                           <span>{parseInt(quantity).toLocaleString()} Adet</span>
                                           {res.strategy === 'multiplier' && (
                                               <>
                                                 <span>•</span>
                                                 <span>{res.details.multiplier} Kalıp</span>
                                               </>
                                           )}
                                        </div>
                                        {/* Display Base Size used for standard calculation to avoid confusion */}
                                        {res.baseDims && (Math.abs(res.baseDims.w - parseFloat(width)) > 1 || Math.abs(res.baseDims.h - parseFloat(height)) > 1) && (
                                            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-secondary-400 bg-secondary-50 px-2 py-1 rounded inline-flex">
                                                <Ruler className="h-3 w-3" />
                                                Standart Ebat: <span className="font-bold text-secondary-600">{res.baseDims.w}x{res.baseDims.h} mm</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Price */}
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-secondary-900 tracking-tighter text-primary-600">
                                            {res.formattedPrice}
                                        </div>
                                        <div className="text-[10px] text-secondary-400 font-bold uppercase tracking-wide">Tahmini Tutar</div>
                                    </div>
                                </div>
                                
                                {/* SMART SIZE SUGGESTION - RENAMED TO 'TASARRUF ÖNERİSİ' (BEST OFFER) */}
                                {res.sizeSuggestion && (
                                     <div className={`relative px-5 py-4 border-t flex flex-col sm:flex-row items-center gap-4 group-hover:bg-opacity-80 transition-colors ${res.sizeSuggestion.isSamePrice ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        
                                        {/* Savings Badge */}
                                        {!res.sizeSuggestion.isSamePrice && res.sizeSuggestion.savingPercent > 0 && (
                                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
                                                <Percent className="h-3 w-3" />
                                                %{res.sizeSuggestion.savingPercent} KAZANÇ
                                            </div>
                                        )}

                                        <div className={`p-2.5 rounded-full shadow-sm shrink-0 border ${res.sizeSuggestion.isSamePrice ? 'bg-white text-blue-600 border-blue-200' : 'bg-white text-emerald-600 border-emerald-200 animate-pulse'}`}>
                                            {res.sizeSuggestion.isSamePrice ? <CheckCircle2 className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                                        </div>
                                        
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-black text-sm uppercase tracking-wide ${res.sizeSuggestion.isSamePrice ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                    {res.sizeSuggestion.isSamePrice ? 'DAHA İYİ SONUÇ' : 'TASARRUF ÖNERİSİ'}
                                                </span>
                                                {!res.sizeSuggestion.isSamePrice && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="text-secondary-400 line-through decoration-red-500/50 decoration-2">{res.formattedPrice}</span>
                                                        <ArrowRight className="h-4 w-4 text-emerald-400" />
                                                        <span className="font-black text-xl text-emerald-600">{res.sizeSuggestion.formattedPrice}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <p className={`text-sm leading-snug ${res.sizeSuggestion.isSamePrice ? 'text-blue-900' : 'text-emerald-900'}`}>
                                                {res.sizeSuggestion.isSamePrice ? (
                                                    <>
                                                        Alternatif olarak ebatı <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-blue-200 shadow-sm mx-1">{res.sizeSuggestion.w_mm}x{res.sizeSuggestion.h_mm} mm</span> yaparsanız 
                                                        standart kalıp olur ve <span className="font-bold underline decoration-blue-300">kesim ücreti ödemezsiniz.</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        Ebatı <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 shadow-sm mx-1 text-emerald-800">{res.sizeSuggestion.w_mm}x{res.sizeSuggestion.h_mm} mm</span> yaparsanız 
                                                        kesim ücreti ödemezsiniz ve <span className="font-bold bg-emerald-100 px-1 rounded text-emerald-800">{res.sizeSuggestion.savingAmount}</span> cebinizde kalır.
                                                    </>
                                                )}
                                                {res.sizeSuggestion.wasteAmt && (
                                                    <span className="block mt-1 text-xs font-bold opacity-80">
                                                        * Ölçünüzde {res.sizeSuggestion.wasteAmt} fire oluşur.
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Suggestions Footer (Quantity) - RENAMED TO 'FIRSAT' */}
                                {(res.prevQty || res.nextQty) && (
                                    <div className="bg-secondary-50 px-5 py-3 border-t border-secondary-100 flex items-center justify-between gap-4 text-xs">
                                        <div className="flex items-center gap-4 w-full">
                                            {res.prevQty && (
                                                <div className="hidden sm:flex items-center gap-1.5 text-secondary-400 opacity-60 hover:opacity-100 transition-opacity">
                                                    <TrendingDown className="h-4 w-4" />
                                                    <span>{res.prevQty.qty.toLocaleString()} Adet:</span>
                                                    <span className="font-mono font-bold">{res.prevQty.price}</span>
                                                </div>
                                            )}
                                            
                                            <div className="hidden sm:block flex-1 border-b border-secondary-200 border-dashed mx-2 h-px opacity-50"></div>

                                            {res.nextQty && (
                                                <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-3 bg-white hover:bg-secondary-50 px-3 py-1.5 rounded-lg border border-secondary-200 shadow-sm cursor-pointer transition-all w-full sm:w-auto text-secondary-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <Sparkles className="h-4 w-4 text-primary-500" />
                                                        <span className="font-medium">FIRSAT: {res.nextQty.qty.toLocaleString()} Adet</span>
                                                    </div>
                                                    <span className="font-bold text-secondary-900">{res.nextQty.price}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {results.length > 0 && (
                         <div className="mt-6 text-center text-xs text-secondary-400 italic">
                            * Fiyatlara KDV dahil değildir. Özel kesim işlerde bıçak izi ve kesim bedeli ayrıca hesaplanmalıdır.
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default PriceCalculator;