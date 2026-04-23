import { Link } from "react-router-dom";
import styles from "../staticDoc.module.scss";

/**
 * Product overview and how the app works (no login required).
 */
export function AboutPage() {
  return (
    <div className={styles.wrap}>
      <Link to="/" className={styles.back}>
        ← Back to Pulkiss
      </Link>
      <article className={styles.article}>
        <h1>About Pulkiss</h1>
        <p className={styles.meta}>
          Pulkiss connects people for casual one-to-one video conversations and optional text chat, with separate
          in-app groups for longer-lived communities.
        </p>

        <h2>What you can do here</h2>
        <ul>
          <li>
            <strong>Random matching</strong> — Join a queue to be paired with another signed-in user. When a match is
            found, your browsers establish a direct <strong>WebRTC</strong> audio/video link when possible, with
            signaling and in-call chat relayed through this app&apos;s server.
          </li>
          <li>
            <strong>Groups</strong> — Create or join groups (where enabled) for shared text chat and a synchronized
            YouTube &quot;watch together&quot; experience. Group data for this deployment lives in the server process
            memory unless your operator configures external storage.
          </li>
          <li>
            <strong>Accounts</strong> — Sign in with email and password (including registration through our API) or
            with Google, handled by <strong>Firebase Authentication</strong>. The server verifies identity using
            Firebase-issued ID tokens; it does not store your password when you use Google.
          </li>
        </ul>

        <h2>How media and chat flow</h2>
        <p>
          Video and audio between matched users are designed to go <strong>peer-to-peer</strong> when your
          network and browser allow it. ICE (STUN/TURN) servers may be configured by whoever runs the API so that
          connections work across more networks. In-call text messages during a match are sent through the server for
          that session only and are not kept as a permanent history after the match ends.
        </p>

        <h2>Safety and expectations</h2>
        <p>
          Random video chat can expose you to unknown people. You should treat interactions like any other open
          internet conversation: do not share secrets, financial data, or anything you would regret being recorded.
          You can leave a match or stop searching at any time. If your deployment includes moderation or reporting,
          use the channels your operator provides.
        </p>

        <h2>Open source &amp; stack</h2>
        <p>
          This project is built with a <strong>React</strong> front end, a <strong>Node.js</strong> server using{" "}
          <strong>Express</strong> and <strong>Socket.io</strong>, and <strong>Firebase</strong> for authentication and
          (where configured) admin user management. See the repository README for how to run and configure your own
          instance.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about a <strong>specific deployment</strong> (for example the site you are using right now),
          contact the person or organization that operates that server. This generic &quot;About&quot; page does not
          list a global support inbox unless your operator adds one to their fork or site.
        </p>
      </article>
    </div>
  );
}
