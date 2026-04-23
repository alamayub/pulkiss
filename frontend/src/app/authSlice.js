import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    ready: false,
    error: null,
  },
  reducers: {
    setAuthState: (state, action) => {
      if (action.payload.user !== undefined) {
        state.user = action.payload.user;
      }
      if (action.payload.ready !== undefined) {
        state.ready = action.payload.ready;
      }
      if (action.payload.error !== undefined) {
        state.error = action.payload.error;
      }
    },
  },
});

export const { setAuthState } = authSlice.actions;
export default authSlice.reducer;
