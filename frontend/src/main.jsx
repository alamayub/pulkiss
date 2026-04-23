import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "./lib/firebase";
import { store } from "./app/store";
import { setAuthState } from "./app/authSlice";
import App from "./App";
import "./index.scss";

const auth = getFirebaseAuth();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const mapUser = (u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
      photoURL: u.photoURL,
    });
    void user.getIdToken().then(() => {
      store.dispatch(setAuthState({ user: mapUser(user), ready: true, error: null }));
    });
  } else {
    store.dispatch(setAuthState({ user: null, ready: true, error: null }));
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
