
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Bible, ContinuityError } from "../types";

// Always use the process.env.API_KEY directly as per @google/genai guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXT_MODEL = "gemini-3-flash-preview"; 
const IMAGE_MODEL = "gemini-2.5-flash-image";

const formatBibleContext = (bible: Bible): string => {
  const characters = bible.characters || [];
  const locations = bible.locations || [];
  return `
PROJECT BIBLE:
SUMMARY: ${bible.summary || "No summary provided."}
CHARACTERS:
${characters.length > 0 ? characters.map(c => `- ${c.name}: ${c.description}`).join('\n') : "No characters defined."}
LOCATIONS:
${locations.length > 0 ? locations.map(l => `- ${l.name}: ${l.description}`).join('\n') : "No locations defined."}
`;
};

const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) str = match[1];
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return str.substring(firstBrace, lastBrace + 1);
  }
  return str;
};

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  if (data.byteLength % 2 !== 0) data = data.slice(0, data.byteLength - 1);
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const runPlannerAgent = async (bible: Bible, idea: string): Promise<string> => {
  const context = formatBibleContext(bible);
  const prompt = `${context}\n\nSCENE IDEA: ${idea}\n\nTASK: Create a Beat Sheet.`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: { systemInstruction: "You are the PLANNER agent. Create a detailed Beat Sheet.", temperature: 0.7 }
  });
  return response.text || "Failed.";
};

export const runWriterAgent = async (bible: Bible, beatSheet: string, existingContent: string = ""): Promise<string> => {
  const context = formatBibleContext(bible);
  const prompt = `${context}\n\nBEAT SHEET:\n${beatSheet}\n\nTASK: Write the scene draft.`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: { systemInstruction: "You are the WRITER agent. Write vivid fiction prose.", temperature: 0.8 }
  });
  return response.text || "Failed.";
};

export const runContinuityAgent = async (bible: Bible, sceneText: string): Promise<ContinuityError[]> => {
  const context = formatBibleContext(bible);
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `${context}\n\nSCENE TEXT:\n${sceneText}`,
    config: {
      systemInstruction: "You are the CONTINUITY agent. Return JSON with 'errors' array.",
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });
  const result = JSON.parse(cleanJsonString(response.text || "{}"));
  return result.errors || [];
};

export const runEditorAgent = async (sceneText: string, instructions: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `TEXT: ${sceneText}\n\nINSTRUCTIONS: ${instructions}`,
    config: { systemInstruction: "You are the EDITOR agent.", temperature: 0.5 }
  });
  return response.text || sceneText;
};

export const runVisualizerAgent = async (bible: Bible, sceneTitle: string, sceneContent: string): Promise<string | null> => {
  const prompt = `Story: ${bible.summary}\nScene: ${sceneTitle}\nContent: ${sceneContent.slice(0, 500)}`;
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: prompt }] }
  });
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateSceneAudio = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.slice(0, 3000) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};
