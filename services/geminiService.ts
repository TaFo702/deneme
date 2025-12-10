import { GoogleGenAI, Type } from "@google/genai";
import { PriceItem } from '../types';

export const analyzeImage = async (base64Image: string, mimeType: string): Promise<PriceItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set REACT_APP_GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this image of a printing price list (matbaa fiyat listesi).
    Extract the tabular data into a structured JSON array.
    
    The table columns typically include:
    - Kategori (Category e.g., Broşür)
    - Ebat (Size e.g., 9.5x20 cm)
    - Kod (Code e.g., 1CA7)
    - Açıklama (Description)
    - Miktar (Quantity e.g., 1.000 Adet)
    - Fiyat (Price e.g., 550 ₺)

    If a value is implied by a row span (like vertical centering in the image), repeat the value for each row.
    Return ONLY the raw JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
            role: 'user',
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Image
                    }
                }
            ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    kategori: { type: Type.STRING },
                    ebat: { type: Type.STRING },
                    kod: { type: Type.STRING },
                    aciklama: { type: Type.STRING },
                    miktar: { type: Type.STRING },
                    fiyat: { type: Type.STRING }
                }
            }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as PriceItem[];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};