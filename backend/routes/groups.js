import express from "express";
import { requireAuth } from "../middleware/authUser.js";
import {
  acceptJoinRequest,
  addGroupPlayerQueueItem,
  addJoinRequest,
  closeGroupByAdmin,
  createGroup,
  getGroupById,
  getGroupMemberUids,
  getGroupDetailForViewer,
  getMessagesPage,
  getRole,
  leaveGroup,
  listGroupsSummary,
  MESSAGES_PAGE,
  postMessage,
  rejectJoinRequest,
  removeMember,
} from "../lib/groupsStore.js";
import { emitGroupPlayerState, emitGroupDisbanded } from "../lib/groupPlayerBroadcast.js";
import {
  emitGroupJoinRequestToAdmins,
  emitGroupJoinDecisionToRequester,
  emitGroupMemberLeftToMembers,
} from "../lib/groupJoinNotify.js";

const router = express.Router();
const MAX_MSG = 2000;

router.post("/", requireAuth, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 200) {
    return res.status(400).json({ error: "Name is required (max 200 characters)" });
  }
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 2000) : null;
  try {
    const group = createGroup(req.user, name, description);
    return res.status(201).json({ group: { id: group.id, name, description, createdBy: group.createdBy } });
  } catch (e) {
    console.error("create group", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to create group" });
  }
});

router.get("/", requireAuth, (req, res) => {
  try {
    const me = req.user.uid;
    return res.json({ groups: listGroupsSummary(me) });
  } catch (e) {
    console.error("list groups", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Server error" });
  }
});

router.post("/:groupId/join-request", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const r = addJoinRequest(groupId, req.user);
  if (r.error === "not_found") {
    return res.status(404).json({ error: "Group not found" });
  }
  if (r.error === "already_member") {
    return res.status(400).json({ error: "Already a member" });
  }
  if (r.error === "already_pending") {
    return res.status(400).json({ error: "Request already pending" });
  }
  const g = getGroupById(groupId);
  if (g) {
    emitGroupJoinRequestToAdmins({
      groupId,
      groupName: g.name,
      requesterUid: req.user.uid,
      requesterName: req.user.name || "Someone",
    });
  }
  return res.json({ ok: true });
});

router.post("/:groupId/requests/:targetUid/accept", requireAuth, (req, res) => {
  const { groupId, targetUid } = req.params;
  if (getRole(groupId, req.user.uid) !== "admin") {
    return res.status(403).json({ error: "Only a group admin can accept requests" });
  }
  const r = acceptJoinRequest(groupId, targetUid);
  if (r.error === "no_request") {
    return res.status(404).json({ error: "No pending request for this user" });
  }
  const g = getGroupById(groupId);
  if (g) {
    emitGroupJoinDecisionToRequester({
      targetUid,
      groupId,
      groupName: g.name,
      outcome: "accepted",
    });
  }
  return res.json({ ok: true });
});

router.post("/:groupId/requests/:targetUid/reject", requireAuth, (req, res) => {
  const { groupId, targetUid } = req.params;
  if (getRole(groupId, req.user.uid) !== "admin") {
    return res.status(403).json({ error: "Only a group admin can reject requests" });
  }
  const r = rejectJoinRequest(groupId, targetUid);
  if (r.error === "no_request") {
    return res.status(404).json({ error: "No pending request" });
  }
  const g = getGroupById(groupId);
  if (g) {
    emitGroupJoinDecisionToRequester({
      targetUid,
      groupId,
      groupName: g.name,
      outcome: "rejected",
    });
  }
  return res.json({ ok: true });
});

router.delete("/:groupId/members/:targetUid", requireAuth, (req, res) => {
  const { groupId, targetUid } = req.params;
  if (targetUid === req.user.uid) {
    return res.status(400).json({ error: "Use DELETE /:groupId/leave to leave the group" });
  }
  if (getRole(groupId, req.user.uid) !== "admin") {
    return res.status(403).json({ error: "Only a group admin can remove members" });
  }
  const r = removeMember(groupId, targetUid);
  if (r.error === "not_member") {
    return res.status(404).json({ error: "User is not a member" });
  }
  return res.json({ ok: true });
});

router.delete("/:groupId/leave", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const r = leaveGroup(groupId, req.user.uid);
  if (r.error === "not_member") {
    return res.status(400).json({ error: "Not a member" });
  }
  if (r.error === "not_found") {
    return res.status(400).json({ error: "Not a member" });
  }
  if (r.groupDeleted) {
    return res.json({ ok: true, groupDeleted: true });
  }
  const g = getGroupById(groupId);
  if (g) {
    const remainingMemberUids = getGroupMemberUids(groupId);
    emitGroupMemberLeftToMembers({
      groupId,
      groupName: g.name,
      leaverUid: req.user.uid,
      leaverName: req.user.name || "A member",
      remainingMemberUids,
    });
  }
  if (r.promotedNewAdmin) {
    return res.json({ ok: true, promotedNewAdmin: r.promotedNewAdmin });
  }
  return res.json({ ok: true });
});

/** Only the group admin may close (delete) the group for all members. */
router.delete("/:groupId/close", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const r = closeGroupByAdmin(groupId, req.user.uid);
  if (r.error === "not_found") {
    return res.status(404).json({ error: "Group not found" });
  }
  if (r.error === "forbidden") {
    return res.status(403).json({ error: "Only a group admin can close the group" });
  }
  emitGroupDisbanded(groupId);
  return res.json({ ok: true, groupDeleted: true });
});

router.get("/:groupId/messages", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const uid = req.user.uid;
  if (!getGroupById(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (!getRole(groupId, uid)) {
    return res.status(403).json({ error: "Members only" });
  }
  const limit = Math.min(Number(req.query.limit) || MESSAGES_PAGE, 100);
  const before = req.query.before ? String(req.query.before) : null;
  try {
    const { messages, hasMore } = getMessagesPage(groupId, before, limit);
    return res.json({ messages, hasMore });
  } catch (e) {
    console.error("get messages", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Server error" });
  }
});

router.post("/:groupId/messages", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const uid = req.user.uid;
  if (!getGroupById(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (!getRole(groupId, uid)) {
    return res.status(403).json({ error: "Members only" });
  }
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "Message text is required" });
  }
  if (text.length > MAX_MSG) {
    return res.status(400).json({ error: `Message too long (max ${MAX_MSG})` });
  }
  try {
    const message = postMessage(groupId, req.user, text);
    return res.status(201).json({ message });
  } catch (e) {
    console.error("post message", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Server error" });
  }
});

/** Add a YouTube link to the group watch queue (members). */
router.post("/:groupId/player/queue", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  if (!url.trim()) {
    return res.status(400).json({ error: "url is required" });
  }
  const r = addGroupPlayerQueueItem(groupId, req.user, url);
  if (r.error === "not_found") {
    return res.status(404).json({ error: "Group not found" });
  }
  if (r.error === "not_member") {
    return res.status(403).json({ error: "Members only" });
  }
  if (r.error === "invalid_youtube") {
    return res.status(400).json({ error: "Not a valid YouTube link" });
  }
  if (r.error === "queue_full") {
    return res.status(400).json({ error: "Queue is full" });
  }
  emitGroupPlayerState(groupId);
  return res.status(201).json({ item: r.item });
});

/**
 * Group detail, members, join requests (if admin) — after /:groupId/messages and /:groupId/leave.
 */
router.get("/:groupId", requireAuth, (req, res) => {
  const { groupId } = req.params;
  const detail = getGroupDetailForViewer(groupId, req.user.uid);
  if (!detail) {
    return res.status(404).json({ error: "Group not found" });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.json(detail);
});

export default router;
