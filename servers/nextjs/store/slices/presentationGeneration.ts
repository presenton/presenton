import { Theme } from "@/app/(presentation-generator)/services/api/types";
import { Slide } from "@/app/(presentation-generator)/types/slide";
import {
  limitOutlines,
  MAX_NUMBER_OF_SLIDES,
} from "@/utils/presentationLimits";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PresentationData {
  id: string;

  language: string;
  layout: any;
  n_slides: number;
  title: string;
  slides: any;
  theme: Theme | null;
  version?: string;
  components?: any;
  fonts?: any;
  structure?: any;
}

interface PresentationGenerationState {
  presentation_id: string | null;
  isLoading: boolean;
  isStreaming: boolean | null;
  outlines: { content: string }[];
  error: string | null;
  presentationData: PresentationData | null;
  isSlidesRendered: boolean;
  isLayoutLoading: boolean;
}

const initialState: PresentationGenerationState = {
  presentation_id: null,
  outlines: [],
  isSlidesRendered: false,
  isLayoutLoading: false,
  isLoading: false,
  isStreaming: null,
  error: null,
  presentationData: null,
};

const presentationGenerationSlice = createSlice({
  name: "presentationGeneration",
  initialState,
  reducers: {
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setLayoutLoading: (state, action: PayloadAction<boolean>) => {
      state.isLayoutLoading = action.payload;
    },
    // Presentation ID
    setPresentationId: (state, action: PayloadAction<string>) => {
      state.presentation_id = action.payload;
      state.error = null;
    },
    // Slides rendered
    setSlidesRendered: (state, action: PayloadAction<boolean>) => {
      state.isSlidesRendered = action.payload;
    },
    // Error
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    // Clear presentation data
    clearPresentationData: (state) => {
      state.presentationData = null;
    },
    clearOutlines: (state) => {
      state.outlines = [];
    },
    // Set outlines
    setOutlines: (state, action: PayloadAction<{ content: string }[]>) => {
      state.outlines = limitOutlines(action.payload);
    },
    // Set presentation data
    setPresentationData: (state, action: PayloadAction<PresentationData>) => {
      state.presentationData = action.payload;
    },
    updateTitle: (state, action: PayloadAction<string>) => {
      if (state.presentationData) {
        state.presentationData.title = action.payload;
      }
    },
    deleteSlideOutline: (state, action: PayloadAction<{ index: number }>) => {
      if (state.outlines) {
        // Remove the slide at the given index
        state.outlines = state.outlines.filter(
          (_, idx) => idx !== action.payload.index
        );
      }
    },
    // SLIDE OPERATIONS
    addSlide: (
      state,
      action: PayloadAction<{ slide: Slide; index: number }>
    ) => {
      if (state.presentationData?.slides) {
        if (state.presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        // Insert the new slide at the specified index
        state.presentationData.slides.splice(
          action.payload.index,
          0,
          action.payload.slide
        );

        // Update indices for all slides to ensure they remain sequential
        state.presentationData.slides = state.presentationData.slides.map(
          (slide: any, idx: number) => ({
            ...slide,
            index: idx,
          })
        );
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    deletePresentationSlide: (state, action: PayloadAction<number>) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        if (
          slides.length <= 1 ||
          action.payload < 0 ||
          action.payload >= slides.length
        ) {
          return;
        }

        slides.splice(action.payload, 1);
        state.presentationData.slides = state.presentationData.slides.map(
          (slide: any, idx: number) => ({
            ...slide,
            index: idx,
          })
        );
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    replaceSlidesWithBlankFallback: (
      state,
      action: PayloadAction<{ slideData: any }>
    ) => {
      if (state.presentationData) {
        state.presentationData.slides = [
          { ...action.payload.slideData, index: 0 },
        ];
        state.presentationData.n_slides = 1;
      }
    },
    duplicatePresentationSlide: (
      state,
      action: PayloadAction<{ index: number; slideId: string }>
    ) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        if (slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        const sourceSlide = slides[action.payload.index];
        if (!sourceSlide) {
          return;
        }

        const duplicatedSlide = {
          ...JSON.parse(JSON.stringify(sourceSlide)),
          id: action.payload.slideId,
          index: action.payload.index + 1,
        };

        slides.splice(action.payload.index + 1, 0, duplicatedSlide);
        state.presentationData.slides = slides.map((slide: any, idx: number) => ({
          ...slide,
          index: idx,
        }));
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    movePresentationSlide: (
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>
    ) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        const { fromIndex, toIndex } = action.payload;
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= slides.length ||
          toIndex >= slides.length
        ) {
          return;
        }

        const [movedSlide] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, movedSlide);
        state.presentationData.slides = slides.map((slide: any, idx: number) => ({
          ...slide,
          index: idx,
        }));
      }
    },
    updateSlide: (
      state,
      action: PayloadAction<{ index: number; slide: Slide }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides[action.payload.index]
      ) {
        state.presentationData.slides[action.payload.index] =
          action.payload.slide;
      }
    },
    updateSlideUi: (
      state,
      action: PayloadAction<{ index: number; ui: Record<string, unknown> | null }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides[action.payload.index]
      ) {
        state.presentationData.slides[action.payload.index].ui =
          action.payload.ui;
      }
    },

    // Update slide content at specific data path (for Tiptap text editing)
    updateSlideContent: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        content: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, content } = action.payload;

        // Helper function to set nested property value
        const setNestedValue = (obj: any, path: string, value: string) => {
          const keys = path.split(/[.\[\]]+/).filter(Boolean);
          let current = obj;

          // Navigate to the parent object
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (isNaN(Number(key))) {
              // String key
              if (!current[key]) {
                current[key] = {};
              }
              current = current[key];
            } else {
              // Array index
              const index = Number(key);
              if (!current[index]) {
                current[index] = {};
              }
              current = current[index];
            }
          }

          // Set the final value
          const finalKey = keys[keys.length - 1];
          if (isNaN(Number(finalKey))) {
            current[finalKey] = value;
          } else {
            current[Number(finalKey)] = value;
          }
        };

        // Update the slide content
        if (dataPath && slide.content) {
          setNestedValue(slide.content, dataPath, content);
        }
      }
    },

    addNewSlide: (state, action: PayloadAction<{ slideData: any; index: number }>) => {
      if (state.presentationData?.slides) {
        if (state.presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        // Insert the new slide at the specified index + 1 (after current slide)
        state.presentationData.slides.splice(action.payload.index + 1, 0, action.payload.slideData);

        // Update indices for all slides to ensure they remain sequential
        state.presentationData.slides = state.presentationData.slides.map(
          (slide: any, idx: number) => ({
            ...slide,
            index: idx,
          })
        );
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },

    // Update slide image at specific data path
    updateSlideImage: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        imageUrl: string;
        prompt?: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, imageUrl, prompt } = action.payload;

        // Helper function to set nested property value for images
        const setNestedImageValue = (obj: any, path: string, url: string, promptText?: string) => {
          const keys = path.split(/[.\[\]]+/).filter(Boolean);
          let current = obj;

          // Navigate to the parent object
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (isNaN(Number(key))) {
              if (!current[key]) {
                current[key] = {};
              }
              current = current[key];
            } else {
              const index = Number(key);
              if (!current[index]) {
                current[index] = {};
              }
              current = current[index];
            }
          }

          // Set the image properties
          const finalKey = keys[keys.length - 1];
          const target = isNaN(Number(finalKey)) ? current[finalKey] : current[Number(finalKey)];

          // Preserve existing properties if the target already exists
          const updatedValue = {
            ...(target && typeof target === 'object' ? target : {}),
            __image_url__: url,
            __image_prompt__: promptText || (target?.__image_prompt__) || ''
          };

          if (isNaN(Number(finalKey))) {
            current[finalKey] = updatedValue;
          } else {
            current[Number(finalKey)] = updatedValue;
          }

        };

        // Update the slide image
        if (dataPath && slide.content) {
          setNestedImageValue(slide.content, dataPath, imageUrl, prompt);
        }

        // Also update the images array if it exists
        if (slide.images && Array.isArray(slide.images)) {
          const imageIndex = parseInt(dataPath.split('[')[1]?.split(']')[0]) || 0;
          if (slide.images[imageIndex] !== undefined) {
            slide.images[imageIndex] = imageUrl;
          }
        }
      }
    },

    updateImageProperties: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        itemIndex: number;
        properties: any;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { itemIndex, properties } = action.payload;
        slide['properties'] = {
          ...slide.properties,
          [itemIndex]: properties
        };

      }
    },

    // Update slide icon at specific data path
    updateSlideIcon: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        iconUrl: string;
        query?: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, iconUrl, query } = action.payload;

        // Helper function to set nested property value for icons
        const setNestedIconValue = (obj: any, path: string, url: string, queryText?: string) => {
          const keys = path.split(/[.\[\]]+/).filter(Boolean);
          let current = obj;

          // Navigate to the parent object
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (isNaN(Number(key))) {
              if (!current[key]) {
                current[key] = {};
              }
              current = current[key];
            } else {
              const index = Number(key);
              if (!current[index]) {
                current[index] = {};
              }
              current = current[index];
            }
          }

          // Set the icon properties
          const finalKey = keys[keys.length - 1];
          const target = isNaN(Number(finalKey)) ? current[finalKey] : current[Number(finalKey)];

          // Preserve existing properties if the target already exists
          const updatedValue = {
            ...(target && typeof target === 'object' ? target : {}),
            __icon_url__: url,
            __icon_query__: queryText || (target?.__icon_query__) || ''
          };

          if (isNaN(Number(finalKey))) {
            current[finalKey] = updatedValue;
          } else {
            current[Number(finalKey)] = updatedValue;
          }

          // Add debugging
          console.log('Redux: Updated slide icon at path:', path, 'with URL:', url);
        };

        // Update the slide icon
        if (dataPath && slide.content) {
          setNestedIconValue(slide.content, dataPath, iconUrl, query);
        }

        // Also update the icons array if it exists
        if (slide.icons && Array.isArray(slide.icons)) {
          const iconIndex = parseInt(dataPath.split('[')[1]?.split(']')[0]) || 0;
          if (slide.icons[iconIndex] !== undefined) {
            slide.icons[iconIndex] = iconUrl;
          }
        }
      }
    },
    updateTheme: (state, action: PayloadAction<Theme | null>) => {
      if (state.presentationData) {
        state.presentationData['theme'] = action.payload;
      }
    },
  },

});

export const {
  setStreaming,
  setLoading,
  setLayoutLoading,
  setPresentationId,
  setSlidesRendered,
  setError,
  clearPresentationData,
  clearOutlines,
  deleteSlideOutline,
  setPresentationData,
  updateTitle,
  setOutlines,
  // slides operations
  addSlide,
  updateSlide,
  updateSlideUi,
  deletePresentationSlide,
  replaceSlidesWithBlankFallback,
  duplicatePresentationSlide,
  movePresentationSlide,
  updateSlideContent,
  updateSlideImage,
  updateImageProperties,
  updateSlideIcon,
  addNewSlide,
  updateTheme,
} = presentationGenerationSlice.actions;

export default presentationGenerationSlice.reducer;
