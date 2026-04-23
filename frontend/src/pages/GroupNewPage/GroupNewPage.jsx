import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { groupsCreate } from "../../lib/api";
import styles from "./GroupNewPage.module.scss";

export function GroupNewPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const r = await groupsCreate({ name, description: description || undefined });
      if (r.group?.id) {
        nav(`/groups/${r.group.id}`);
      }
    } catch (er) {
      setErr(er.data?.error || er.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1>Create group</h1>
      <p className={styles.muted}>You will be the admin and can accept join requests and remove members.</p>
      {err && <p className={styles.err}>{err}</p>}
      <form onSubmit={submit} className={styles.form}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={200} />
        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
        />
        <div className={styles.row}>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? "…" : "Create"}
          </button>
          <Link to="/groups" className={styles.secondary}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
