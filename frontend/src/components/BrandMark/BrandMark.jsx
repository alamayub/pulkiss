import styles from "./BrandMark.module.scss";

/**
 * @param {{ size?: "sm" | "md" | "lg", showWordmark?: boolean, className?: string }} props
 */
export function BrandMark({ size = "md", showWordmark = true, className = "" }) {
  return (
    <div className={`${styles.wrap} ${styles[size]} ${className}`.trim()}>
      <div className={styles.mark} aria-hidden>
        <svg className={styles.pSvg} viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="19" className={styles.ring} />
          <path
            className={styles.pPath}
            d="M14 11h7.2c3.2 0 5.5 2.1 5.5 5 0 2.9-2.3 5-5.5 5H18.2V29h-4.2V11zm4.2 3.6v5.8h2.8c1.5 0 2.5-.9 2.5-2.4 0-1.5-1-2.4-2.6-2.4h-2.7z"
          />
        </svg>
      </div>
      {showWordmark ? <span className={styles.wordmark}>pulkiss</span> : null}
    </div>
  );
}
