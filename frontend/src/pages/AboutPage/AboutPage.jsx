import styles from "../staticDoc.module.scss";

/**
 * Product overview and how the app works (no login required).
 */
export function AboutPage() {
  return (
    <div className={styles.wrap}>
      <article className={styles.article}>
        <h2>Random match</h2>
        <p>
          Sign in, tap Start, and you enter a queue. When someone else is waiting, the app pairs you and helps your
          browsers negotiate a call. Video and audio usually travel <strong>directly between devices</strong> (WebRTC)
          when your network allows; the server carries signaling, presence, and the short text chat that appears during
          the match. That chat is for the live session only and is not stored as a long-term log after you disconnect or
          skip.
        </p>

        <h2>Groups</h2>
        <p>
          Groups give you a place to stay in touch beyond a single call: text chat and a synchronized YouTube player so
          you can watch together. What is persisted and where depends on how this instance is configured—many setups keep
          group state in server memory unless an operator plugs in external storage.
        </p>

        <h2>Sign-in</h2>
        <p>
          Accounts use <strong>Firebase Authentication</strong>—for example Google or email/password where enabled.
          The backend checks Firebase ID tokens; it never sees your Google password. Registration flows may go through
          this app&apos;s API according to how your host has set things up.
        </p>

        <h2>Networks and reliability</h2>
        <p>
          NATs, firewalls, and corporate Wi-Fi can block pure peer-to-peer media. Operators can supply STUN/TURN (ICE)
          servers so more calls connect. If video fails, text chat may still work through the same socket session.
        </p>

        <h2>Staying safe</h2>
        <p>
          Random video is real-time and unpredictable. Treat strangers like the open web: avoid sharing passwords,
          banking details, addresses, or anything you would not want repeated or recorded. You can stop searching, skip
          a match, or sign out at any time. Reporting and moderation depend on whoever runs this deployment—use their
          channels if they offer them.
        </p>

        <h2>Built with</h2>
        <p>
          The UI is <strong>React</strong>; the API and realtime layer are <strong>Node.js</strong> with{" "}
          <strong>Express</strong> and <strong>Socket.io</strong>. Auth and optional admin tooling lean on{" "}
          <strong>Firebase</strong>. Clone or fork the repo and read the README to run your own copy and tune
          environment variables.
        </p>

        <h2>Questions about this site</h2>
        <p>
          This page describes the product in general. For downtime, abuse, privacy on a particular URL, or account
          issues on that host, reach out to the team that operates <em>this</em> deployment—they are the ones who can
          change policy, moderation, and configuration.
        </p>

        <p className={styles.meta}>
          Pulkiss is a small web app for spontaneous video introductions and lightweight group spaces. You can drop into
          a random one-to-one call when you feel social, or keep a group for chat and shared YouTube viewing.
        </p>
      </article>
    </div>
  );
}
