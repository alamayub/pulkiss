import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import roomReducer from "./roomSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    room: roomReducer,
    ui: uiReducer,
  },
});
