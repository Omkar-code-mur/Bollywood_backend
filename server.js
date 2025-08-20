/** @format */
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Connect to SQLite
const db = new sqlite3.Database("./movies.db", (err) => {
  if (err) console.error("Error opening database", err);
  else console.log("Connected to SQLite database");
});

// Create tables if they don’t exist

// ✅ Fetch all movies
app.get("/movies", (req, res) => {
  db.all("SELECT * FROM movies", [], (err, rows) => {
    if (err) return res.status(500).send("Failed to fetch movies");
    res.json(rows);
  });
});

// ✅ Leaderboard
app.get("/leaderboard", (req, res) => {
  const query = `
    SELECT id, username, score,
    RANK() OVER (ORDER BY score DESC) as rank
    FROM users ORDER BY score DESC LIMIT 10
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send("Failed to fetch leaderboard");
    res.json(rows);
  });
});

// ✅ Create user (idempotent)
app.post("/create-user", (req, res) => {
  const { username, score } = req.body;

  // Check if username already exists
  db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (row) {
      // Username already exists → return existing ID
      return res.json({ userId: row.id });
    }

    // If not exists, insert new
    db.run(
      "INSERT INTO users (username, score) VALUES (?, ?)",
      [username, score || 0],
      function (err2) {
        if (err2) {
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ userId: this.lastID });
      }
    );
  });
});

// ✅ Update score
app.post("/update-score", (req, res) => {
  const { userId, score } = req.body;
  if (!userId || typeof score !== "number")
    return res.status(400).send("Invalid request");

  const query = `UPDATE users SET score = ? WHERE id = ?`;
  db.run(query, [score, userId], function (err) {
    if (err) return res.status(500).send("Failed to update score");
    res.status(200).send("Score updated successfully");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
