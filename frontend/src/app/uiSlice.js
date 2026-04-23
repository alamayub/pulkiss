import { createSlice } from "@reduxjs/toolkit";

/**
 * @typedef {Object} ToastItem
 * @property {string} id
 * @property {"error" | "warning" | "success"} type
 * @property {string} message
 */

const initialState = {
  /** @type {ToastItem[]} */
  toasts: [],
  /** Full-screen loading overlay: `null` = hidden, string = message under spinner */
  authLoadingMessage: /** @type {string | null} */ (null),
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    addToast: {
      reducer: (state, action) => {
        state.toasts.push(action.payload);
        if (state.toasts.length > 6) {
          state.toasts = state.toasts.slice(-6);
        }
      },
      prepare: ({ type, message }) => ({
        payload: {
          id: globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type,
          message,
        },
      }),
    },
    removeToast: (state, action) => {
      const id = action.payload;
      state.toasts = state.toasts.filter((t) => t.id !== id);
    },
    setAuthLoadingMessage: (state, action) => {
      state.authLoadingMessage = action.payload;
    },
  },
});

export const { addToast, removeToast, setAuthLoadingMessage } = uiSlice.actions;
export default uiSlice.reducer;
