import React, { useState, useMemo } from 'react';
import { PriceItem } from '../types';
import { Search, Filter, Layers, ArrowDownUp, Sparkles } from 'lucide-react';

interface PriceListProps {
  data: PriceItem[];
}

// Helper to parse description moved outside to be static/reusable
const parseDescription = (fullDesc: string) => {
  // Expected format: "115 gr. Parlak Kuşe - Details..."
  const parts = fullDesc.split('-').map(p => p.trim());
  
  if (parts.length > 0) {
      const titlePart = parts[0]; // "115 gr. Parlak Kuşe"
      const details = parts.slice(1).join(' - '); // "Ön 4 Renk..."
      
      // Match standard weights: 115 gr., 350 Gr., 40 Mikron
      let weightMatch = titlePart.match(/^(\d+\s*([gG]r\.|[mM]ikron))\s+(.+)$/);
      
      // If not found, check for special "Yapraklar 250 lik" format for Küp Bloknot
      if (!weightMatch) {
          const blockMatch = titlePart.match(/^Yapraklar\s+(\d+\s*l[iü]k)(.*)$/);
          if (blockMatch) {
              return {
                  weight: blockMatch[1], // "250 lik"
                  paperType: blockMatch[2].replace(/^[;\s,]+/, '') || titlePart, // Rest of the string
                  details: details || fullDesc,
                  rawTitle: titlePart
              };
          }
      }

      if (weightMatch) {
          return {
              weight: weightMatch[1], // "115 gr." or "40 Mikron"
              paperType: weightMatch[3], // "Parlak Kuşe" (Group 3 because Group 2 is the unit)
              details: details || fullDesc, // Fallback if no details after hyphen
              rawTitle: titlePart // For comparison
          };
      }
      
      return {
          weight: '',
          paperType: titlePart,
          details: details || '',
          rawTitle: titlePart
      };
  }
  
  return { weight: '', paperType: '', details: fullDesc, rawTitle: fullDesc };
};

// --- SMART SEARCH ENGINE ---

// 1. Normalize: Lowercase, Map Turkish Chars, Keep specific chars for identifying separate words
const normalizeText = (text: string) => {
  let normalized = text.toLocaleLowerCase('tr');
  const trMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
  normalized = normalized.replace(/[çğıöşü]/g, char => trMap[char] || char);
  // Keep alphanumeric and single spaces. Remove special chars that aren't useful for text search.
  return normalized.replace(/[^a-z0-9\s]/g, '').trim(); 
};

// 2. Levenshtein Distance for Typo Tolerance
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[b.length][a.length];
};

const PriceList: React.FC<PriceListProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredData = useMemo(() => {
    // 0. If empty, return all
    if (!searchTerm.trim()) return data;

    // 1. Split search input into clean terms
    const rawSearchTerms = searchTerm.split(/\s+/).filter(t => t.length > 0);
    const normalizedSearchTerms = rawSearchTerms.map(normalizeText);

    // 2. Score and Filter Items
    const scoredItems = data.map(item => {
        let totalScore = 0;
        let matchCount = 0;

        // Pre-normalize item fields for performance
        const normKod = normalizeText(item.kod);
        const normKategori = normalizeText(item.kategori);
        const normEbat = normalizeText(item.ebat);
        const normAciklama = normalizeText(item.aciklama);
        const normMiktar = normalizeText(item.miktar);

        // Check EACH search term against the item (AND Logic)
        // If a term doesn't match anything in the item, the item is discarded (score = 0)
        for (const term of normalizedSearchTerms) {
            let termScore = 0;

            // Priority 1: Exact Code Match (Highest Value)
            if (normKod === term) termScore = 100;
            else if (normKod.includes(term)) termScore = 50;

            // Priority 2: Category Match
            else if (normKategori === term) termScore = 80;
            else if (normKategori.includes(term)) termScore = 40;
            else if (levenshteinDistance(normKategori, term) <= 2) termScore = 20; // Fuzzy

            // Priority 3: Size Match
            else if (normEbat === term) termScore = 60;
            else if (normEbat.includes(term)) termScore = 30;

            // Priority 4: Description Match
            else if (normAciklama.includes(term)) termScore = 10;
            // Fuzzy check on description words (expensive but useful)
            else {
                const words = normAciklama.split(' ');
                const bestFuzzy = words.some(w => Math.abs(w.length - term.length) <= 2 && levenshteinDistance(w, term) <= 1);
                if (bestFuzzy) termScore = 5;
            }

            // Priority 5: Quantity Match
            if (termScore === 0) {
                 if (normMiktar.includes(term)) termScore = 15;
            }

            // If this term didn't match ANYTHING, the item fails the AND test.
            if (termScore === 0) {
                matchCount = -1; // Fail flag
                break;
            }

            totalScore += termScore;
            matchCount++;
        }

        // If all terms matched something, return the item with its score
        if (matchCount === normalizedSearchTerms.length) {
            return { item, score: totalScore };
        }
        return null;
    });

    // 3. Filter nulls and Sort by Score
    const result = scoredItems
        .filter((i): i is { item: PriceItem, score: number } => i !== null)
        .sort((a, b) => b.score - a.score)
        .map(i => i.item);

    return result;

  }, [data, searchTerm]);

  // Suggestion Logic for Zero Results
  const suggestion = useMemo(() => {
    if (filteredData.length > 0) return null;
    const term = normalizeText(searchTerm);
    if (!term || term.length < 3) return null;

    // Collect candidates from data
    const candidates = new Set<string>();
    data.forEach(item => {
        candidates.add(item.kategori);
        const info = parseDescription(item.aciklama);
        if (info.paperType) candidates.add(info.paperType);
    });

    let bestWord = '';
    let bestDist = Infinity;

    candidates.forEach(cand => {
        // Only suggest if the candidate is somewhat similar
        const normCand = normalizeText(cand);
        // Skip if lengths are too different
        if (Math.abs(normCand.length - term.length) > 3) return;

        const dist = levenshteinDistance(term, normCand);
        if (dist < bestDist && dist <= 3) { // Allow max 3 edits
             bestDist = dist;
             bestWord = cand;
        }
    });

    return bestWord;
  }, [filteredData, searchTerm, data]);

  // Group filtered data by category
  const groupedData = useMemo(() => {
    const groups: Record<string, PriceItem[]> = {};
    const categories: string[] = [];

    filteredData.forEach(item => {
      const groupKey = item.kategori;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
        categories.push(groupKey);
      }
      groups[groupKey].push(item);
    });

    return { groups, categories: Array.from(new Set(categories)) };
  }, [filteredData]);

  // Helper function to calculate rowSpan dynamically based on a key generator
  const calculateSpan = (items: PriceItem[], index: number, keyGetter: (i: PriceItem) => string) => {
    const currentKey = keyGetter(items[index]);
    
    // If previous item has same key, this one is hidden (span 0)
    if (index > 0 && keyGetter(items[index - 1]) === currentKey) {
      return 0;
    }

    // Calculate span forward
    let span = 1;
    for (let i = index + 1; i < items.length; i++) {
      if (keyGetter(items[i]) === currentKey) {
        span++;
      } else {
        break;
      }
    }
    return span;
  };

  // 1. Group Key for the First Column (Category / Product)
  const getProductGroupKey = (item: PriceItem) => {
      const info = parseDescription(item.aciklama);
      return `${item.kategori}_${info.weight || ''}_${info.paperType || ''}_${item.ebat}`;
  };

  // 2. Group Key for the Size Column
  const getEbatGroupKey = (item: PriceItem) => {
      return getProductGroupKey(item);
  };

  return (
    <div className="w-full space-y-6">
      
      {/* SEARCH HEADER */}
      <div className="relative bg-white rounded-xl p-4 mb-4 overflow-hidden shadow-lg border border-secondary-200">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 max-w-7xl mx-auto">
            
            <div className="text-center md:text-left w-full md:w-auto md:pr-8 flex flex-col md:flex-row items-center justify-center md:justify-start gap-4">
                 <div>
                     <h2 className="text-3xl font-black text-secondary-900 leading-tight whitespace-nowrap">
                        <span className="text-primary-600">Hızlı Fiyat</span> Sorgulama
                     </h2>
                     <p className="text-secondary-600 text-sm mt-1 leading-snug hidden md:block">
                        Aradığınız ürünü veya özelliği yana yazın (örn: Kartvizit, 350 gr, Selefonlu)
                     </p>
                 </div>
                 <span className="bg-indigo-50 text-indigo-600 text-xs font-extrabold px-2.5 py-1 rounded border border-indigo-200 uppercase tracking-wide whitespace-nowrap">
                    ARALIK 2025
                 </span>
            </div>

            <div className="relative w-full md:flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Search className="h-5 w-5 text-primary-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-3 text-base font-bold border border-primary-500 rounded-lg leading-tight bg-white text-secondary-900 placeholder-secondary-400 focus:outline-none shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-primary-500/50 transition-all duration-300"
                    placeholder="Ürün, kod veya özellik yazın (örn: 1000, brosur, kuse)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-secondary-200 shadow-sm animate-fade-in">
            <div className="flex flex-col items-center justify-center">
                <div className="bg-secondary-100 p-4 rounded-full mb-3">
                    <Filter className="h-8 w-8 text-secondary-400" />
                </div>
                <h3 className="text-lg font-semibold text-secondary-700 mb-1">Sonuç Bulunamadı</h3>
                <p className="text-secondary-500 text-sm max-w-md mx-auto">
                    Aradığınız kriterlere uygun ürün bulamadık. Kelime hatası yapmış olabilirsiniz.
                </p>
                
                {suggestion && (
                    <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3 inline-block animate-pulse">
                        <span className="text-secondary-600 text-sm">Bunu mu demek istediniz: </span>
                        <button 
                            onClick={() => setSearchTerm(suggestion)}
                            className="font-bold text-primary-600 hover:underline flex items-center gap-1.5 inline-flex ml-1 text-lg"
                        >
                            <Sparkles className="h-4 w-4" />
                            {suggestion}
                        </button>
                    </div>
                )}

                <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-6 text-secondary-500 font-bold hover:text-secondary-700 hover:underline text-sm"
                >
                    Tüm listeyi göster
                </button>
            </div>
        </div>
      ) : (
        <div className="space-y-12 animate-fade-in-up">
            {groupedData.categories.map((category) => {
                const items = groupedData.groups[category];
                
                return (
                    <div key={category} className="space-y-0">
                        {/* Group Header */}
                        <div className="bg-secondary-800 text-white px-6 py-3 rounded-t-xl flex items-center justify-between border-b-4 border-primary-500 shadow-sm">
                           <div className="flex items-center gap-2">
                               <Layers className="h-5 w-5 text-primary-500" />
                               <h3 className="font-bold text-lg tracking-wide uppercase">{category}</h3>
                           </div>
                           {/* Show match count badge if searching */}
                           {searchTerm && (
                               <span className="bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                                   {items.length} Sonuç
                               </span>
                           )}
                        </div>

                        <div className="bg-white rounded-b-xl overflow-hidden shadow-xl border border-secondary-200 border-t-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-secondary-100 text-secondary-900 border-b border-secondary-300">
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider border-r border-secondary-300 w-48 text-center">Kategori / Ürün</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider border-r border-secondary-300 text-center w-32">Ebat</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider border-r border-secondary-300 w-24">Kod</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider border-r border-secondary-300 w-1/3">Açıklama</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider border-r border-secondary-300">Miktar</th>
                                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-right bg-primary-100 text-primary-900 w-32">Fiyat (TL)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-200 bg-white">
                                        {items.map((item, index) => {
                                            const productSpan = calculateSpan(items, index, getProductGroupKey);
                                            const ebatSpan = calculateSpan(items, index, getEbatGroupKey);
                                            const parsedInfo = parseDescription(item.aciklama);
                                            
                                            return (
                                                <tr key={`${item.kod}-${index}`} className="hover:bg-primary-50/20 transition-colors duration-150 group">
                                                    {/* Kategori / Product Cell */}
                                                    {productSpan > 0 && (
                                                        <td 
                                                            rowSpan={productSpan} 
                                                            className="p-4 border-r border-secondary-200 align-middle bg-secondary-50 text-center border-b border-b-secondary-200"
                                                        >
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="text-lg font-black text-secondary-900 uppercase tracking-tight leading-none mb-1">{item.kategori}</span>
                                                                
                                                                {parsedInfo.weight && (
                                                                    <span className="text-primary-600 font-extrabold text-lg leading-none mb-1">{parsedInfo.weight}</span>
                                                                )}
                                                                
                                                                {parsedInfo.paperType && (
                                                                    <span className="text-secondary-600 font-bold text-xs uppercase text-center leading-tight max-w-[120px]">{parsedInfo.paperType}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Ebat Cell */}
                                                    {ebatSpan > 0 && (
                                                        <td 
                                                            rowSpan={ebatSpan}
                                                            className="p-4 text-sm text-secondary-800 font-bold border-r border-secondary-200 whitespace-nowrap align-middle bg-white text-center border-b border-b-secondary-200"
                                                        >
                                                            <div className="inline-block bg-secondary-100 text-secondary-900 px-3 py-1.5 rounded font-mono text-sm border border-secondary-200 shadow-sm">
                                                            {item.ebat}
                                                            </div>
                                                        </td>
                                                    )}

                                                    <td className="p-4 text-sm text-secondary-500 font-mono border-r border-secondary-200 group-hover:text-primary-600 transition-colors">
                                                        {item.kod}
                                                    </td>
                                                    <td className="p-4 text-sm text-secondary-700 border-r border-secondary-200 leading-snug">
                                                        {parsedInfo.details || item.aciklama}
                                                    </td>
                                                    <td className="p-4 text-sm text-secondary-900 font-bold border-r border-secondary-200">
                                                        {item.miktar}
                                                    </td>
                                                    <td className="p-4 text-lg font-black text-secondary-900 text-right group-hover:bg-primary-50/30">
                                                        <span className="text-primary-600">{item.fiyat}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {/* Footer for each category table */}
                                <div className="bg-secondary-50 px-4 py-3 text-xs text-secondary-500 border-t border-secondary-200 font-medium italic text-center">
                                    İç kısımlar müşteri tarafından yerleştirilecektir. * Adet ve tonlarda %5 - %7 arasında farklılıklar olabilir.
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      )}
      
      <div className="flex justify-between items-center text-xs text-secondary-400 font-medium px-2">
         <span>Fiyatlara KDV dahil değildir.</span>
         <span className="flex items-center gap-1">
             <ArrowDownUp className="h-3 w-3" />
             Toplam {filteredData.length} kayıt listelendi.
         </span>
      </div>
    </div>
  );
};

export default PriceList;