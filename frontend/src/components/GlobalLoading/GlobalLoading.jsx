import { useSelector } from "react-redux";
import styles from "./GlobalLoading.module.scss";

/**
 * Full-page blocking overlay (e.g. while signing in or registering).
 */
export function GlobalLoading() {
  const message = useSelector((s) => s.ui.authLoadingMessage);
  if (!message) {
    return null;
  }
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="assertive"
      aria-label={message}
    >
      <div className={styles.spinner} aria-hidden />
      <p className={styles.caption}>{message}</p>
    </div>
  );
}
