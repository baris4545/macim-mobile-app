import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import "./db.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.listen(3000, () => {
  console.log("MAÇIM API running on http://localhost:3000");
});
// ✅ Send message
app.post("/messages", authMiddleware, (req, res) => {
  const { receiver_id, text } = req.body || {};
  if (!receiver_id || !text) return res.status(400).json({ error: "missing_fields" });

  db.run(
    `INSERT INTO messages(sender_id, receiver_id, text) VALUES (?, ?, ?)`,
    [req.user.userId, Number(receiver_id), String(text)],
    function (err) {
      if (err) return res.status(500).json({ error: "db_error", detail: String(err) });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

// ✅ Get chat with a user
app.get("/messages/chat/:otherUserId", authMiddleware, (req, res) => {
  const otherUserId = Number(req.params.otherUserId);
  if (!otherUserId) return res.status(400).json({ error: "invalid_other_user" });

  db.all(
    `
    SELECT id, sender_id, receiver_id, text, created_at
    FROM messages
    WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
    ORDER BY id ASC
    `,
    [req.user.userId, otherUserId, otherUserId, req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error", detail: String(err) });
      return res.json({ ok: true, messages: rows || [] });
    }
  );
});

// ✅ Inbox (conversation list)
app.get("/messages/inbox", authMiddleware, (req, res) => {
  db.all(
    `
    SELECT
      m.id,
      m.text,
      m.created_at,
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS other_user_id
    FROM messages m
    JOIN (
      SELECT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_user_id,
        MAX(id) AS last_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY other_user_id
    ) x ON x.last_id = m.id
    ORDER BY m.id DESC
    `,
    [req.user.userId, req.user.userId, req.user.userId, req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error", detail: String(err) });
      return res.json({ ok: true, inbox: rows || [] });
    }
  );
});
