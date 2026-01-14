import bcrypt from "bcrypt";
import cors from "cors";
import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const app = express();

// CORS + JSON
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

if (!process.env.JWT_SECRET) {
  console.log("❌ .env dosyasında JWT_SECRET eksik!");
  console.log('Örnek: JWT_SECRET="macim_secret_123"');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "macim.db");
const db = new sqlite3.Database(dbPath);
console.log("✅ DB PATH:", dbPath);

/* ------------------- DB TABLES ------------------- */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      position TEXT,
      city TEXT,
      age INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS profile_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Teams (istersen kullanmaya devam et)
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      needed_players INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS player_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      position TEXT NOT NULL,
      city TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS match_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      city TEXT NOT NULL,
      field TEXT NOT NULL,
      match_date TEXT NOT NULL,
      match_time TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      price TEXT,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      field_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      price INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_res_unique
    ON reservations(field_id, date, time)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS field_settings (
      field_id TEXT PRIMARY KEY,
      price INTEGER NOT NULL DEFAULT 1200,
      open_hour INTEGER NOT NULL DEFAULT 12,
      close_hour INTEGER NOT NULL DEFAULT 24
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
});

/* ------------------- MIGRATION (eski db'ler için) ------------------- */
db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN name TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN position TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN city TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN age INTEGER", () => {});
});

/* ------------------- SEED FIELDS ------------------- */
db.get("SELECT COUNT(*) as count FROM fields", (_, row) => {
  if ((row?.count ?? 0) === 0) {
    db.run(
      `INSERT INTO fields (name, city, latitude, longitude, price, phone)
       VALUES
       ('Arena Halı Saha', 'İstanbul', 41.0082, 28.9784, '₺900 / saat', '0555 111 22 33'),
       ('Gol Park', 'İstanbul', 41.0200, 28.9500, '₺750 / saat', '0555 444 55 66'),
       ('Şut Arena', 'Ankara', 39.9334, 32.8597, '₺700 / saat', '0555 777 88 99')`
    );
  }
});

/* ------------------- AUTH ------------------- */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}

/* ------------------- AUTH ROUTES ------------------- */
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ ok: false, error: "missing_fields" });
  if (password.length < 6)
    return res.status(400).json({ ok: false, error: "password_too_short" });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const cleanEmail = String(email).toLowerCase().trim();

    db.run(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [cleanEmail, password_hash],
      function (err) {
        if (err) {
          if (String(err).includes("UNIQUE"))
            return res.status(400).json({ ok: false, error: "email_exists" });
          return res
            .status(500)
            .json({ ok: false, error: "db_error", detail: String(err) });
        }
        const token = signToken({ id: this.lastID, email: cleanEmail });
        return res.json({ ok: true, token });
      }
    );
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "server_error", detail: String(e) });
  }
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ ok: false, error: "missing_fields" });

  const cleanEmail = String(email).toLowerCase().trim();

  db.get(
    "SELECT id, email, password_hash FROM users WHERE email = ?",
    [cleanEmail],
    async (err, user) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      if (!user)
        return res
          .status(401)
          .json({ ok: false, error: "invalid_credentials" });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok)
        return res
          .status(401)
          .json({ ok: false, error: "invalid_credentials" });

      const token = signToken({ id: user.id, email: user.email });
      return res.json({ ok: true, token });
    }
  );
});

/* ------------------- PROFILE ------------------- */
app.get("/me", authMiddleware, (req, res) => {
  db.get(
    "SELECT id, email, name, position, city, age, avatar, created_at FROM users WHERE id = ?",
    [req.user.userId],
    (err, row) => {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      if (!row) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, user: row });
    }
  );
});


app.put("/me", authMiddleware, (req, res) => {
  const { name, position, city, age, avatar } = req.body || {};

  db.run(
    `
    UPDATE users
    SET
      name     = COALESCE(?, name),
      position = COALESCE(?, position),
      city     = COALESCE(?, city),
      age      = COALESCE(?, age),
      avatar   = COALESCE(?, avatar)
    WHERE id = ?
    `,
    [
      name && String(name).trim() !== "" ? String(name).trim() : null,
      position && String(position).trim() !== "" ? String(position).trim() : null,
      city && String(city).trim() !== "" ? String(city).trim() : null,
      age !== undefined && age !== null && age !== "" ? Number(age) : null,
      avatar && String(avatar).trim() !== "" ? String(avatar) : null, // base64 data url
      req.user.userId,
    ],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, changes: this.changes });
    }
  );
});


/* ------------------- PLAYERS ------------------- */
app.post("/players", authMiddleware, (req, res) => {
  const { position, city, note } = req.body || {};
  if (!position || !city)
    return res.status(400).json({ ok: false, error: "missing" });

  db.run(
    "INSERT INTO player_posts (user_id, position, city, note) VALUES (?, ?, ?, ?)",
    [
      req.user.userId,
      String(position).trim(),
      String(city).trim(),
      note ? String(note) : null,
    ],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/players", authMiddleware, (_req, res) => {
  db.all(
    `
    SELECT p.id, p.user_id, p.position, p.city, p.note, p.created_at, u.name
    FROM player_posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.id DESC
    `,
    [],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, posts: rows || [] });
    }
  );
});

// ✅ Benim oyuncu ilanlarım
app.get("/my/player-posts", authMiddleware, (req, res) => {
  db.all(
    `
    SELECT p.id, p.user_id, p.position, p.city, p.note, p.created_at, u.name
    FROM player_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
    ORDER BY p.id DESC
    `,
    [req.user.userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, posts: rows || [] });
    }
  );
});

/* ------------------- MATCHES ------------------- */
app.post("/matches", authMiddleware, (req, res) => {
  const { city, field, match_date, match_time, note } = req.body || {};
  if (!city || !field || !match_date || !match_time)
    return res.status(400).json({ ok: false, error: "missing" });

  db.run(
    `INSERT INTO match_posts (user_id, city, field, match_date, match_time, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      req.user.userId,
      String(city).trim(),
      String(field).trim(),
      String(match_date).trim(),
      String(match_time).trim(),
      note ? String(note) : null,
    ],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/matches", authMiddleware, (_req, res) => {
  db.all(
    `
    SELECT m.id, m.user_id, m.city, m.field, m.match_date, m.match_time, m.note, m.created_at, u.name
    FROM match_posts m
    JOIN users u ON u.id = m.user_id
    ORDER BY m.id DESC
    `,
    [],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, matches: rows || [] });
    }
  );
});

// ✅ Benim maç ilanlarım
app.get("/my/match-posts", authMiddleware, (req, res) => {
  db.all(
    `
    SELECT m.id, m.user_id, m.city, m.field, m.match_date, m.match_time, m.note, m.created_at, u.name
    FROM match_posts m
    JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ?
    ORDER BY m.id DESC
    `,
    [req.user.userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, matches: rows || [] });
    }
  );
});
/* ===================== MY POSTS (UPDATE / DELETE) ===================== */

// ✅ Oyuncu ilanı güncelle
app.put("/my/player-posts/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

  const { position, city, note } = req.body || {};

  const cleanPosition = position != null ? String(position).trim() : null;
  const cleanCity = city != null ? String(city).trim() : null;
  const cleanNote = note != null ? String(note) : null;

  if (cleanPosition !== null && cleanPosition.length === 0) {
    return res.status(400).json({ ok: false, error: "position_required" });
  }
  if (cleanCity !== null && cleanCity.length === 0) {
    return res.status(400).json({ ok: false, error: "city_required" });
  }

  db.run(
    `
    UPDATE player_posts
    SET
      position = COALESCE(?, position),
      city     = COALESCE(?, city),
      note     = COALESCE(?, note)
    WHERE id = ? AND user_id = ?
    `,
    [cleanPosition, cleanCity, cleanNote, id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true });
    }
  );
});

// ✅ Oyuncu ilanı sil
app.delete("/my/player-posts/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

  db.run(
    "DELETE FROM player_posts WHERE id = ? AND user_id = ?",
    [id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true });
    }
  );
});

// ✅ Maç ilanı güncelle
app.put("/my/match-posts/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

  const { city, field, match_date, match_time, note } = req.body || {};

  const cleanCity = city != null ? String(city).trim() : null;
  const cleanField = field != null ? String(field).trim() : null;
  const cleanDate = match_date != null ? String(match_date).trim() : null;
  const cleanTime = match_time != null ? String(match_time).trim() : null;
  const cleanNote = note != null ? String(note) : null;

  // Eğer field gönderildiyse boş olamaz vb.
  const mustNotEmpty = [
    ["city_required", cleanCity],
    ["field_required", cleanField],
    ["match_date_required", cleanDate],
    ["match_time_required", cleanTime],
  ];
  for (const [errCode, v] of mustNotEmpty) {
    if (v !== null && v.length === 0) return res.status(400).json({ ok: false, error: errCode });
  }

  db.run(
    `
    UPDATE match_posts
    SET
      city       = COALESCE(?, city),
      field      = COALESCE(?, field),
      match_date = COALESCE(?, match_date),
      match_time = COALESCE(?, match_time),
      note       = COALESCE(?, note)
    WHERE id = ? AND user_id = ?
    `,
    [cleanCity, cleanField, cleanDate, cleanTime, cleanNote, id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true });
    }
  );
});

// ✅ Maç ilanı sil
app.delete("/my/match-posts/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

  db.run(
    "DELETE FROM match_posts WHERE id = ? AND user_id = ?",
    [id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true });
    }
  );
});




/* ------------------- RESERVATIONS ------------------- */

// ✅ Rezervasyon oluştur
app.post("/reservations", authMiddleware, (req, res) => {
  const { field_id, field_name, date, time, price } = req.body || {};

  if (!field_id || !field_name || !date || !time || !price) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  db.run(
    `INSERT INTO reservations (user_id, field_id, field_name, date, time, price)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      req.user.userId,
      String(field_id),
      String(field_name),
      String(date),
      String(time),
      Number(price),
    ],
    function (err) {
      if (err) {
        // Aynı saha + aynı tarih + aynı saat doluysa UNIQUE index patlar
        if (String(err).includes("UNIQUE")) {
          return res.status(409).json({ ok: false, error: "slot_taken" });
        }
        return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      }

      return res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/my/reservations", authMiddleware, (req, res) => {
  db.all(
    `
    SELECT id, field_id, field_name, date, time, price, created_at
    FROM reservations
    WHERE user_id=?
    ORDER BY date DESC, time DESC
    `,
    [req.user.userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, reservations: rows || [] });
    }
  );
});

app.delete("/reservations/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

  db.run(
    "DELETE FROM reservations WHERE id=? AND user_id=?",
    [id, req.user.userId],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      if (this.changes === 0)
        return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true });
    }
  );
});
// ✅ Müsaitlik: dolu saatleri döndür
app.get("/reservations/availability", authMiddleware, (req, res) => {
  const { field_id, date } = req.query || {};
  if (!field_id || !date) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  // Varsayılan çalışma saatleri (senin UI: 12-23)
  const DEFAULT_OPEN = 12;
  const DEFAULT_CLOSE = 24; // 24 -> 23:00 son slot gibi düşün (23:59'a kadar)

  db.get(
    `SELECT price, open_hour, close_hour FROM field_settings WHERE field_id = ?`,
    [String(field_id)],
    (err, settings) => {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });

      const open_hour = settings?.open_hour ?? DEFAULT_OPEN;
      const close_hour = settings?.close_hour ?? DEFAULT_CLOSE;
      const price = settings?.price ?? 1200;

      db.all(
        `SELECT time FROM reservations WHERE field_id = ? AND date = ?`,
        [String(field_id), String(date)],
        (err2, rows) => {
          if (err2) return res.status(500).json({ ok: false, error: "db_error", detail: String(err2) });

          const taken = (rows || []).map((r) => String(r.time).slice(0, 5)); // "HH:MM"
          return res.json({
            ok: true,
            field_id: String(field_id),
            date: String(date),
            open_hour,
            close_hour,
            price,
            taken,
          });
        }
      );
    }
  );
});


/* ------------------- PROFILE RESERVATIONS ------------------- */
app.post("/profile-reservations", authMiddleware, (req, res) => {
  const { title, date, time, note } = req.body || {};
  if (!title || !date || !time)
    return res.status(400).json({ ok: false, error: "missing_fields" });

  db.run(
    `INSERT INTO profile_reservations (user_id, title, date, time, note)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.userId, title, date, time, note ?? null],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/my/profile-reservations", authMiddleware, (req, res) => {
  db.all(
    `
    SELECT *
    FROM profile_reservations
    WHERE user_id=?
    ORDER BY date DESC, time DESC
    `,
    [req.user.userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, reservations: rows || [] });
    }
  );
});

/* ===================== CHAT / MESSAGES ===================== */
app.get("/messages/inbox", authMiddleware, (req, res) => {
  const me = req.user.userId;

  db.all(
    `
    SELECT
      m.id,
      m.text,
      m.created_at,
      x.other_user_id,
      u.name  AS other_user_name,
      u.email AS other_user_email
    FROM messages m
    JOIN (
      SELECT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_user_id,
        MAX(id) AS last_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY other_user_id
    ) x ON x.last_id = m.id
    LEFT JOIN users u ON u.id = x.other_user_id
    ORDER BY m.id DESC
    `,
    [me, me, me],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      res.json({ ok: true, inbox: rows || [] });
    }
  );
});


app.get("/messages/chat/:otherUserId", authMiddleware, (req, res) => {
  const me = req.user.userId;
  const other = Number(req.params.otherUserId);
  if (!other)
    return res.status(400).json({ ok: false, error: "invalid_other_user" });

  db.all(
    `
    SELECT id, sender_id, receiver_id, text, created_at
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY id ASC
    `,
    [me, other, other, me],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, messages: rows || [] });
    }
  );
});

app.post("/messages", authMiddleware, (req, res) => {
  const me = req.user.userId;
  const { receiver_id, text } = req.body || {};
  if (!receiver_id || !text)
    return res.status(400).json({ ok: false, error: "missing_fields" });

  db.run(
    `INSERT INTO messages(sender_id, receiver_id, text) VALUES (?, ?, ?)`,
    [me, Number(receiver_id), String(text)],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ ok: false, error: "db_error", detail: String(err) });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});
// ✅ Sohbeti (iki taraflı) kalıcı sil
app.delete("/messages/conversation/:otherUserId", authMiddleware, (req, res) => {
  const me = req.user.userId;
  const other = Number(req.params.otherUserId);
  if (!other) return res.status(400).json({ ok: false, error: "invalid_other_user" });

  db.run(
    `
    DELETE FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    `,
    [me, other, other, me],
    function (err) {
      if (err) {
        return res.status(500).json({ ok: false, error: "db_error", detail: String(err) });
      }
      return res.json({ ok: true, deleted: this.changes || 0 });
    }
  );
});


/* ------------------- DEBUG (ilanlarım niye boş?) ------------------- */
app.get("/debug/my-posts", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  db.get(
    "SELECT COUNT(*) as c FROM player_posts WHERE user_id=?",
    [userId],
    (e1, r1) => {
      if (e1) return res.status(500).json({ ok: false, error: String(e1) });
      db.get(
        "SELECT COUNT(*) as c FROM match_posts WHERE user_id=?",
        [userId],
        (e2, r2) => {
          if (e2) return res.status(500).json({ ok: false, error: String(e2) });
          return res.json({
            ok: true,
            userId,
            player_posts: r1?.c ?? 0,
            match_posts: r2?.c ?? 0,
          });
        }
      );
    }
  );
});

/* ------------------- HEALTH ------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ------------------- ERROR HANDLERS ------------------- */
// Global error handler (JSON)
app.use((err, _req, res, _next) => {
  console.log("❌ Uncaught error:", err);
  return res.status(500).json({ ok: false, error: "server_error", detail: String(err) });
});

// ✅ Tek 404 handler (JSON)
app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: "not_found",
    path: req.originalUrl,
    method: req.method,
  });
});
db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN avatar TEXT", () => {});
});


app.listen(process.env.PORT || 3000, () => {
  console.log("MAÇIM API running on", process.env.PORT || 3000);
});
