import { Link } from "react-router-dom";
import styles from "../staticDoc.module.scss";

/**
 * Privacy policy for Pulkiss (informational; adjust for your jurisdiction with legal counsel if needed).
 */
export function PrivacyPolicyPage() {
  return (
    <div className={styles.wrap}>
      <Link to="/" className={styles.back}>
        ← Back to Pulkiss
      </Link>
      <article className={styles.article}>
        <h1>Privacy policy</h1>
        <p className={styles.meta}>
          <strong>Last updated:</strong> April 23, 2026. This policy describes how the Pulkiss web application
          and its backend typically handle information. Whoever <strong>hosts</strong> a particular deployment is the
          data controller for that instance; if you use someone else&apos;s server, read their notices too.
        </p>

        <h2>1. Who we are</h2>
        <p>
          &quot;We&quot; in this document means the operator of the Pulkiss instance you are using—the entity
          that controls the web app URL and API you connect to. Authentication is processed by <strong>Google Firebase</strong>{" "}
          on behalf of that operator according to Firebase&apos;s terms and privacy documentation.
        </p>

        <h2>2. Information we collect</h2>
        <p>Depending on features you use, the following categories may apply:</p>
        <ul>
          <li>
            <strong>Account and profile data</strong> — When you register or sign in, Firebase may process your email
            address, display name, authentication provider identifiers, and related security metadata. Our API may read
            your Firebase ID token to identify your user ID and display name for in-app features (for example groups or
            admin tools).
          </li>
          <li>
            <strong>Usage and connection data</strong> — The server may log technical events (such as errors,
            connection counts, or matchmaking activity) as configured by the operator. Socket connections may be used
            to implement presence counts and real-time features.
          </li>
          <li>
            <strong>Random match sessions</strong> — Peer-to-peer video and audio streams are not intended to be
            stored on our server as media recordings. Text chat during a random match is relayed through the server for
            delivery and is not designed to be retained after the session ends, subject to logging or backups the
            operator enables.
          </li>
          <li>
            <strong>Groups</strong> — Group names, messages, membership, join requests, and related activity may be
            held in server memory for this process. A standard deployment does not write that data to a durable
            database; restarting the server typically clears it unless your operator has changed the architecture.
          </li>
        </ul>

        <h2>3. How we use information</h2>
        <ul>
          <li>To provide sign-in, matching, chat, groups, and notifications you request.</li>
          <li>To secure the service, prevent abuse, and debug operational issues.</li>
          <li>To comply with law where the operator is legally required to do so.</li>
        </ul>

        <h2>4. Legal bases (EEA/UK users)</h2>
        <p>
          Where GDPR-style rules apply, processing is generally based on <strong>contract</strong> (providing the
          service you asked for), <strong>legitimate interests</strong> (security and improvement, balanced against your
          rights), or <strong>consent</strong> where required (for example certain cookies or marketing, if offered).
          Your operator should refine this section for their role and region.
        </p>

        <h2>5. Sharing and subprocessors</h2>
        <p>
          <strong>Google Firebase</strong> processes authentication data under Google&apos;s policies.{" "}
          <strong>WebRTC</strong> may involve STUN/TURN providers configured by the operator. We do not sell your
          personal information as part of the open-source app design; a commercial host must disclose their own sharing
          practices.
        </p>

        <h2>6. Retention</h2>
        <p>
          Firebase retains account data according to Firebase/Google settings and your actions (for example deleting your
          Firebase account). In-app group and match state in a default single-server deployment are volatile and may
          disappear on restart. Server or edge logs may be retained for a period chosen by the operator.
        </p>

        <h2>7. Your choices and rights</h2>
        <ul>
          <li>You may be able to access, correct, or delete account data through Firebase or flows your operator exposes.</li>
          <li>You can disconnect from matching, leave groups, or sign out at any time.</li>
          <li>Depending on your region, you may have rights to object, restrict, port, or complain to a supervisory authority.</li>
        </ul>

        <h2>8. Children</h2>
        <p>
          This service is <strong>not directed at children under 13</strong> (or the minimum age required in your
          country). The operator should not collect personal information from children knowingly. If you believe a child
          has provided data, contact the host so they can remove it.
        </p>

        <h2>9. International transfers</h2>
        <p>
          Firebase and other providers may process data in the United States and other countries. Standard contractual
          clauses or other mechanisms may apply depending on provider and region.
        </p>

        <h2>10. Security</h2>
        <p>
          We use industry-standard transport (HTTPS, WSS) and token verification for API and socket access. No method of
          transmission over the internet is 100% secure; use the service with that in mind.
        </p>

        <h2>11. Changes</h2>
        <p>
          The operator may update this policy. Material changes should be reflected by updating this page and the
          &quot;Last updated&quot; date at the top.
        </p>

        <h2>12. Contact</h2>
        <p>
          For privacy requests about the <strong>instance you are using</strong>, contact the deployment operator. If
          you are the operator, publish a contact method (email or form) suitable for your users and jurisdiction.
        </p>
      </article>
    </div>
  );
}
