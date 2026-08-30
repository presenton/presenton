import { LLMConfig } from "@/types/llm_config";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserConfigState {
  can_change_keys: boolean
  llm_config: LLMConfig
}

const initialState: UserConfigState = {
  llm_config: {
    LLM: "",
    IMAGE_PROVIDER: "gpt-image-1.5",

  },
  can_change_keys: false,
}

const userConfigSlice = createSlice({
  name: "userConfig",
  initialState: initialState,
  reducers: {
    setLLMConfig: (state, action: PayloadAction<LLMConfig>) => {
      state.llm_config = action.payload;
    },
    setCanChangeKeys: (state, action: PayloadAction<boolean>) => {
      state.can_change_keys = action.payload;
    }
  },
});

export const { setLLMConfig, setCanChangeKeys } = userConfigSlice.actions;
export default userConfigSlice.reducer;
