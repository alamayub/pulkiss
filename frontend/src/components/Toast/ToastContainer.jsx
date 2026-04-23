import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { removeToast } from "../../app/uiSlice";
import styles from "./ToastContainer.module.scss";

const TOAST_TTL_MS = 5200;

/**
 * Renders global toast stack; each toast auto-dismisses.
 */
export function ToastContainer() {
  const toasts = useSelector((s) => s.ui.toasts);
  const dispatch = useDispatch();
  const scheduled = useRef(/** @type {Set<string>} */ (new Set()));
  const timeouts = useRef(/** @type {Map<string, ReturnType<typeof setTimeout>>} */ (new Map()));

  useEffect(() => {
    for (const toast of toasts) {
      if (scheduled.current.has(toast.id)) {
        continue;
      }
      scheduled.current.add(toast.id);
      const t = setTimeout(() => {
        scheduled.current.delete(toast.id);
        timeouts.current.delete(toast.id);
        dispatch(removeToast(toast.id));
      }, TOAST_TTL_MS);
      timeouts.current.set(toast.id, t);
    }
  }, [toasts, dispatch]);

  if (toasts.length === 0) {
    return null;
  }

  const dismiss = (id) => {
    const t = timeouts.current.get(id);
    if (t) {
      clearTimeout(t);
      timeouts.current.delete(id);
    }
    scheduled.current.delete(id);
    dispatch(removeToast(id));
  };

  return (
    <div className={styles.root} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => dismiss(toast.id)}
        >
          <span className={styles.typeLabel} aria-hidden>
            {toast.type === "error"
              ? "Error"
              : toast.type === "warning"
                ? "Warning"
                : toast.type === "info"
                  ? "Info"
                  : "Success"}
          </span>
          {toast.message}
        </button>
      ))}
    </div>
  );
}
