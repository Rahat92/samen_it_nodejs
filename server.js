import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "User" ORDER BY "createdAt" DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const { rows } = await pool.query(
      'INSERT INTO "User" (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.post("/sms", async (req, res) => {
  if (req.query.secret !== process.env.POSTAL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body;
    const p = body.payload ?? {};
    const m = p.message ?? {};

    await pool.query(
      `INSERT INTO mail_events
        (uuid, event, occurred_at, postal_msg_id, token, direction, message_id,
         to_address, from_address, subject, status, details, output,
         sent_with_ssl, duration_sec, payload)
       VALUES
        ($1, $2, to_timestamp($3), $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         $14, $15, $16)
       ON CONFLICT (uuid) DO NOTHING`,
      [
        body.uuid,
        body.event,
        body.timestamp ?? p.timestamp,
        m.id ?? null,
        m.token ?? null,
        m.direction ?? null,
        m.message_id ?? null,
        m.to ?? null,
        m.from ?? null,
        m.subject ?? null,
        p.status ?? null,
        p.details ?? null,
        p.output ?? null,
        p.sent_with_ssl ?? null,
        p.time ?? null,
        JSON.stringify(body),
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save event" });
  }
});
app.get("/sms", async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "mail_events" ORDER BY "created_at" DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch mail events" });
  }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));