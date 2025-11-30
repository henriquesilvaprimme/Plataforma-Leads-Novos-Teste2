import { GoogleGenAI, Type } from "@google/genai";
import { Lead, AIAnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey });

/**
 * Analyzes a lead using Gemini to provide a score and action plan.
 */
export const analyzeLeadWithAI = async (lead: Lead): Promise<AIAnalysisResult> => {
  if (!apiKey) {
    console.warn("API Key missing");
    return {
      score: 0,
      summary: "API Key not configured. Unable to analyze.",
      actionPlan: ["Check API Key configuration"]
    };
  }

  const prompt = `
    Analyze the following auto insurance lead data. 
    Vehicle: ${lead.vehicleModel} (${lead.vehicleYear})
    City: ${lead.city}
    Status: ${lead.status}
    Insurance Type: ${lead.insuranceType}
    Notes: ${lead.notes}

    Task:
    1. Assign a lead score from 0 to 100 based on likelihood to close and value (newer cars and comprehensive insurance are higher value).
    2. Write a 1-sentence summary of why this score was given.
    3. Provide 3 specific bullet points on how a broker should approach this client.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Score from 0 to 100" },
            summary: { type: Type.STRING, description: "One sentence justification" },
            actionPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3 action items"
            }
          },
          required: ["score", "summary", "actionPlan"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AIAnalysisResult;

  } catch (error) {
    console.error("Error analyzing lead:", error);
    return {
      score: 0,
      summary: "Error during AI analysis.",
      actionPlan: ["Retry analysis later"]
    };
  }
};

/**
 * Generates a personalized cold email for a lead using Gemini.
 */
export const generateColdEmail = async (lead: Lead): Promise<string> => {
    if (!apiKey) return "Please configure your API Key to generate emails.";

    const prompt = `
      Write a professional, short, and persuasive WhatsApp message or Email to ${lead.name}.
      
      Context:
      - We are an Auto Insurance Broker.
      - Vehicle: ${lead.vehicleModel} - ${lead.vehicleYear}.
      - Interest: ${lead.insuranceType}.
      - Current Status: '${lead.status}'.
      
      Tone: Professional, friendly, and helpful. Focus on safety and best price. 
      Language: Portuguese (Brazil).
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text || "Could not generate email.";
    } catch (error) {
      console.error("Error generating email:", error);
      return "Error generating email. Please try again.";
    }
};