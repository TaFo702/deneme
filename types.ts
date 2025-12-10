export interface PriceItem {
  kategori: string;
  ebat: string;
  kod: string;
  aciklama: string;
  miktar: string;
  fiyat: string;
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
}