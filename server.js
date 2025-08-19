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
db.run(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    actor TEXT,
    actress TEXT,
    director TEXT,
    music_director TEXT,
    year INTEGER
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    score INTEGER DEFAULT 0
  )
`);

// ✅ Fetch all movies
app.get("/movies", (req, res) => {
  db.all("SELECT * FROM movies", [], (err, rows) => {
    if (err) return res.status(500).send("Failed to fetch movies");
    res.json(rows);
  });
});

app.post("/create-user", (req, res) => {
  const { username, score } = req.body;

  db.run(
    "INSERT INTO users (username, score) VALUES (?, ?)",
    [username, score || 0],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Username already taken" });
        }
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ userId: this.lastID });
    }
  );
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

// ✅ Leaderboard
app.get("/leaderboard", (req, res) => {
  const query = `
    SELECT username, score,
    RANK() OVER (ORDER BY score DESC) as rank
    FROM users ORDER BY score DESC LIMIT 10
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send("Failed to fetch leaderboard");
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
