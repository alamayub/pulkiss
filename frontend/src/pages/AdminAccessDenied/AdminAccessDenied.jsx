import { Link } from "react-router-dom";
import styles from "./AdminAccessDenied.module.scss";

export function AdminAccessDenied() {
  return (
    <div className={styles.wrap}>
      <h1>Access denied</h1>
      <p>Only the configured admin account can open the user management page.</p>
      <Link to="/" className={styles.link}>
        Back to the app
      </Link>
    </div>
  );
}
