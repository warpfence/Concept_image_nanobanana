/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Part } from "@google/genai";

// --- STATE MANAGEMENT ---
interface AppState {
  inputImage: {
    base64: string;
    mimeType: string;
  } | null;
  conceptImage: {
    base64: string;
    mimeType: string;
  } | null;
  isLoading: boolean;
  result: {
    imageBase64: string | null;
    text: string | null;
  };
}

const state: AppState = {
  inputImage: null,
  conceptImage: null,
  isLoading: false,
  result: {
    imageBase64: null,
    text: null,
  },
};

// --- DOM ELEMENTS ---
const uploadArea = document.getElementById("upload-area")!;
const imageUploadInput = document.getElementById("image-upload") as HTMLInputElement;
const inputPreview = document.getElementById("input-preview") as HTMLImageElement;
const uploadPlaceholder = document.getElementById("upload-placeholder")!;

const conceptUploadArea = document.getElementById("concept-upload-area")!;
const conceptUploadInput = document.getElementById("concept-upload") as HTMLInputElement;
const conceptPreview = document.getElementById("concept-preview") as HTMLImageElement;
const conceptPlaceholder = document.getElementById("concept-placeholder")!;

const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;

const resultArea = document.getElementById("result-area")!;
const resultPlaceholder = document.getElementById("result-placeholder")!;
const loader = document.getElementById("loader")!;
const resultContainer = document.getElementById("result-container")!;
const resultImage = document.getElementById("result-image") as HTMLImageElement;
const resultText = document.getElementById("result-text")!;

// --- CONSTANTS ---
const AI_PROMPT = "You will be given two images. The first image is the **content source**. The second image is the **style reference**. Your task is to generate a new image that combines the content of the first image with the artistic style, color palette, and texture of the second image. Do not mix the content of the images; only transfer the style.";

// --- GEMINI API ---
let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    alert("Could not initialize the AI. Please check the API key configuration.");
}

// --- UI UPDATE FUNCTIONS ---

function updateUI() {
  // Update Input Preview
  if (state.inputImage) {
    inputPreview.src = `data:${state.inputImage.mimeType};base64,${state.inputImage.base64}`;
    inputPreview.classList.add("visible");
    uploadPlaceholder.classList.add("hidden");
  } else {
    inputPreview.classList.remove("visible");
    uploadPlaceholder.classList.remove("hidden");
  }

  // Update Concept Preview
  if (state.conceptImage) {
    conceptPreview.src = `data:${state.conceptImage.mimeType};base64,${state.conceptImage.base64}`;
    conceptPreview.classList.add("visible");
    conceptPlaceholder.classList.add("hidden");
  } else {
    conceptPreview.classList.remove("visible");
    conceptPlaceholder.classList.remove("hidden");
  }

  // Update Generate Button
  generateBtn.disabled = !(state.inputImage && state.conceptImage) || state.isLoading;

  // Update Result Area
  loader.classList.toggle("hidden", !state.isLoading);
  resultPlaceholder.classList.toggle("hidden", state.isLoading || !!state.result.imageBase64);
  resultContainer.classList.toggle("hidden", state.isLoading || !state.result.imageBase64);

  if (state.result.imageBase64) {
    resultImage.src = `data:image/png;base64,${state.result.imageBase64}`;
  }
  if (state.result.text) {
    resultText.textContent = state.result.text;
  }
}

// --- EVENT HANDLERS ---

function handleImageUpload(file: File, type: 'input' | 'concept') {
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }

  const reader = new FileReader();
  reader.onloadend = () => {
    const base64String = (reader.result as string).split(",")[1];
    const imageData = {
      base64: base64String,
      mimeType: file.type,
    };
    if (type === 'input') {
        state.inputImage = imageData;
    } else {
        state.conceptImage = imageData;
    }
    updateUI();
  };
  reader.readAsDataURL(file);
}

async function handleGenerate() {
  if (!state.inputImage || !state.conceptImage || !ai) {
    return;
  }

  state.isLoading = true;
  state.result = { imageBase64: null, text: null };
  updateUI();

  try {
    const inputImagePart: Part = {
      inlineData: {
        data: state.inputImage.base64,
        mimeType: state.inputImage.mimeType,
      },
    };
    
    const conceptImagePart: Part = {
        inlineData: {
            data: state.conceptImage.base64,
            mimeType: state.conceptImage.mimeType,
        }
    };

    const textPart: Part = { text: AI_PROMPT };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [inputImagePart, conceptImagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        state.result.text = part.text;
      } else if (part.inlineData) {
        state.result.imageBase64 = part.inlineData.data;
      }
    }
  } catch (error) {
    console.error("Error during image generation:", error);
    alert("An error occurred while generating the image. Please try again.");
    state.result = { imageBase64: null, text: "Generation failed." };
  } finally {
    state.isLoading = false;
    updateUI();
  }
}

// --- INITIALIZATION ---

function initialize() {
  // Setup input upload area listeners
  uploadArea.addEventListener("click", () => imageUploadInput.click());
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "var(--primary-color)";
  });
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.style.borderColor = "var(--border-color)";
  });
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "var(--border-color)";
    if (e.dataTransfer?.files[0]) {
      handleImageUpload(e.dataTransfer.files[0], 'input');
    }
  });
  imageUploadInput.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
      handleImageUpload(target.files[0], 'input');
    }
  });

  // Setup concept upload area listeners
  conceptUploadArea.addEventListener("click", () => conceptUploadInput.click());
  conceptUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    conceptUploadArea.style.borderColor = "var(--primary-color)";
  });
  conceptUploadArea.addEventListener("dragleave", () => {
    conceptUploadArea.style.borderColor = "var(--border-color)";
  });
  conceptUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    conceptUploadArea.style.borderColor = "var(--border-color)";
    if (e.dataTransfer?.files[0]) {
      handleImageUpload(e.dataTransfer.files[0], 'concept');
    }
  });
  conceptUploadInput.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
      handleImageUpload(target.files[0], 'concept');
    }
  });
  
  // Setup generate button
  generateBtn.addEventListener("click", handleGenerate);

  // Initial UI render
  updateUI();
}

initialize();