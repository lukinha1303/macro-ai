import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FoodItem {
  name: string;
  portion: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface AnalysisResult {
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  summary: string;
}

export async function analyzeMealImage(base64Image: string): Promise<AnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Analise esta imagem de refeição. Identifique cada item alimentar (especialmente arroz, feijão, carne, etc.).
            Para cada item, estime a quantidade em gramas (g) e a porcentagem de confiança da detecção (0-100).
            Calcule as calorias usando estas referências médias:
            - 100g de arroz = 130 kcal
            - 100g de feijão = 77 kcal
            - 100g de carne = 250 kcal
            Para outros alimentos, use valores nutricionais padrão.
            Calcule também proteínas (g), carboidratos (g) e gorduras (g).
            Forneça um resumo nutricional em português.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                portion: { type: Type.STRING, description: "Descrição legível da porção, ex: '1 concha média'" },
                grams: { type: Type.NUMBER, description: "Peso estimado em gramas" },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER, description: "Confiança da detecção de 0 a 100" },
              },
              required: ["name", "portion", "grams", "calories", "protein", "carbs", "fat", "confidence"],
            },
          },
          totalCalories: { type: Type.NUMBER },
          totalProtein: { type: Type.NUMBER },
          totalCarbs: { type: Type.NUMBER },
          totalFat: { type: Type.NUMBER },
          summary: { type: Type.STRING },
        },
        required: ["items", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "summary"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(text) as AnalysisResult;
}
