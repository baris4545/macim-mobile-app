        import bcrypt from "bcrypt";
import express from "express";
import { db } from "../db.js";
import { signToken } from "../utils/jwt.js";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.sendStatus(400);

  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email exists" });
      const token = signToken({ id: this.lastID });
      res.json({ token });
    }
  );
});

// LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (!user) return res.sendStatus(401);

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.sendStatus(401);

      const token = signToken({ id: user.id });
      res.json({ token });
    }
  );
});

export default router;
