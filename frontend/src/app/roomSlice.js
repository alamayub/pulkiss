import { createSlice } from "@reduxjs/toolkit";

const roomSlice = createSlice({
  name: "room",
  initialState: {
    onlineCount: 0,
  },
  reducers: {
    setOnlineCount: (state, action) => {
      if (typeof action.payload === "number" && action.payload >= 0) {
        state.onlineCount = action.payload;
      }
    },
  },
});

export const { setOnlineCount } = roomSlice.actions;
export default roomSlice.reducer;
