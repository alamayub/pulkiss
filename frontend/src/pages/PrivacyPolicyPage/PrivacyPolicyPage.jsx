import styles from "../staticDoc.module.scss";

/**
 * Privacy policy for Pulkiss (informational; adjust for your jurisdiction with legal counsel if needed).
 */
export function PrivacyPolicyPage() {
  return (
    <div className={styles.wrap}>
      <article className={styles.article}>
        <p>
          <strong>Last updated:</strong> April 24, 2026. This page explains how information is usually handled when you
          use the Pulkiss web app and its API. The organization or person that <strong>hosts</strong> the instance you
          connect to acts as the data controller for that site; Firebase and other vendors process data under their own
          terms as well. If you did not deploy this software yourself, read any extra notices your host publishes.
        </p>

        <h2>Who this refers to</h2>
        <p>
          &quot;We&quot; means whoever operates the URL and backend you are using. Sign-in is handled by{" "}
          <strong>Google Firebase Authentication</strong> under Google&apos;s agreements; our server verifies Firebase ID
          tokens to know your user ID and profile fields it needs for features like groups or admin screens.
        </p>

        <h2>Information that may be collected</h2>
        <p>
          <strong>Account and profile.</strong> Email, display name, provider IDs, and related security metadata flow
          through Firebase when you register or sign in. Our application reads what Firebase exposes in the token and
          profile APIs to personalize the product and enforce access rules.
        </p>
        <p>
          <strong>Technical and usage data.</strong> The server may record connection events, errors, queue and match
          activity, presence counts, and similar telemetry depending on configuration. Socket.io traffic carries realtime
          messages and state between your browser and the host&apos;s infrastructure.
        </p>
        <p>
          <strong>Random match calls.</strong> Video and audio are meant to go peer-to-peer when WebRTC succeeds; we do
          not design the core app to record those media streams on the server. In-call text is relayed for live delivery
          and is not intended to be kept as a permanent archive after the session ends—subject to any logging or backups
          the operator enables.
        </p>
        <p>
          <strong>Groups.</strong> Names, messages, membership, join requests, and watch-together state may live in
          process memory on a typical single-node deployment. A restart often clears that data unless the host has wired
          in durable storage.
        </p>

        <h2>Why we process it</h2>
        <p>
          To run authentication, matching, chat, groups, and notifications you ask for; to protect the service and fix
          outages; and to meet legal obligations where they apply to the operator.
        </p>

        <h2>Legal bases (EEA and UK)</h2>
        <p>
          Where GDPR-style laws apply, processing is commonly grounded in <strong>contract</strong> (delivering the
          service), <strong>legitimate interests</strong> (security and reliability, weighed against your rights), or{" "}
          <strong>consent</strong> when the law requires it—for example optional analytics or marketing if the host adds
          them. The controller for your instance should align this wording with their legal advice and role.
        </p>

        <h2>Sharing and subprocessors</h2>
        <p>
          <strong>Google</strong> processes authentication data as described in Firebase and Google privacy documents.{" "}
          <strong>ICE providers</strong> (STUN/TURN) configured for WebRTC may see metadata needed to set up calls.
          The open-source project is not built to sell personal data; a commercial operator must still disclose their own
          recipients and contracts.
        </p>

        <h2>How long things are kept</h2>
        <p>
          Firebase retention follows Google&apos;s settings and whether you delete your account. Volatile in-app state
          (matches, group rooms) may vanish when the server restarts unless persistence is added. Log files and backups,
          if any, are kept for whatever period the host chooses.
        </p>

        <h2>Your choices</h2>
        <p>
          You can leave matching, leave groups, or sign out whenever you like. Access, correction, or deletion of
          account-level data may be available through Firebase, your Google account, or tools the operator provides.
          Depending on where you live, you may also have rights to object, restrict processing, data portability, or to
          complain to a regulator.
        </p>

        <h2>Children</h2>
        <p>
          Pulkiss is <strong>not aimed at children under 13</strong> (or the higher minimum age in your country). Hosts
          should not knowingly collect personal information from children. If you think a minor&apos;s data was
          collected in error, contact the operator of the site you used.
        </p>

        <h2>Cross-border processing</h2>
        <p>
          Firebase and other infrastructure may run in the United States and elsewhere. Providers may rely on standard
          contractual clauses, adequacy decisions, or other transfer tools depending on the service and region.
        </p>

        <h2>Security</h2>
        <p>
          We rely on HTTPS and authenticated sockets where the stack is configured that way. No online service can
          promise perfect security; use strong passwords, keep devices updated, and avoid sharing sensitive material in
          random calls.
        </p>

        <h2>Changes to this page</h2>
        <p>
          Operators may revise this policy. When they do, they should update the text here and bump the &quot;Last
          updated&quot; line at the top so visitors can see what changed.
        </p>

        <h2>Who to contact</h2>
        <p>
          For access, deletion, or privacy questions about <strong>this deployment</strong>, reach the team that runs
          the server behind the URL you are visiting. If you operate an instance yourself, publish a reachable contact
          (email or form) that matches your jurisdiction&apos;s expectations.
        </p>
      </article>
    </div>
  );
}
