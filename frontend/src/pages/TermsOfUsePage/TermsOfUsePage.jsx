import { Link } from "react-router-dom";
import styles from "../staticDoc.module.scss";

/**
 * Terms page for Pulkiss (informational; have counsel review for production).
 */
export function TermsOfUsePage() {
  return (
    <div className={styles.wrap}>
      <article className={styles.article}>
        <h2>Acceptance</h2>
        <p>
          By creating an account, signing in, or otherwise using the service, you agree to these Terms of Use and to our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the product.
        </p>

        <h2>Description of the service</h2>
        <p>
          Pulkiss offers features such as random one-to-one matching with optional video, voice, and short relayed chat;
          in-memory groups with chat and synchronized media playback; and optional staff tools where enabled. Features,
          availability, and retention depend on how the operator configured the instance.
        </p>

        <h2>Accounts and security</h2>
        <p>
          Authentication is provided through <strong>Firebase</strong> (for example Google or email/password). You are
          responsible for safeguarding credentials and for activity under your account. Notify the operator if you
          suspect unauthorized access.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Do not use the service to harass, threaten, or harm others; to distribute illegal content; to attempt to break
          into systems or other users&apos; accounts; or to overload or disrupt the service. Random match and group
          features are social—stay lawful and respectful. The operator may suspend or terminate access for violations.
        </p>

        <h2>User content and groups</h2>
        <p>
          Content you send (for example group chat messages or queue URLs) may be processed and stored according to the
          operator&apos;s configuration. Do not upload material you do not have rights to share. Other participants may
          see what you post in shared spaces.
        </p>

        <h2>Disclaimer</h2>
        <p>
          The software is provided <strong>as available</strong>. Peer-to-peer media depends on networks and browsers;
          we do not guarantee call quality or connectivity. To the extent permitted by law, operators disclaim warranties
          not expressly stated here and limit liability as their counsel advises.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated. The operator should revise this page and bump the &quot;Last updated&quot; note at
          the end when material changes are made.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these terms for <strong>this deployment</strong>, contact whoever runs the site at the URL
          you are visiting.
        </p>

        <p className={styles.meta}>
          <strong>Last updated:</strong> April 24, 2026. These terms describe rules for using the Pulkiss web app and
          the API instance you connect to. The <strong>operator</strong> of the deployment you use may publish additional
          or overriding terms—follow those if they apply.
        </p>
      </article>
    </div>
  );
}
