/** @format */
const XLSX = require("xlsx");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const multer = require("multer");
const path = require("path");

// Set up multer storage (using memory storage to keep file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create an Express app
const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "movies.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error connecting to database:", err.message);
  } else {
    console.log("✅ Connected to the SQLite database at", dbPath);
  }
});

// Create table with UNIQUE constraint on movie_name
db.run(
  `
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_name TEXT UNIQUE,
    release_year INTEGER,
    genre TEXT,
    actor TEXT,
    actress TEXT,
    side_actor TEXT,
    side_actress TEXT,
    song_name TEXT,
    movie_letter TEXT,
    song_letter TEXT,
    actor_letter TEXT,
    actress_letter TEXT
  )
`,
  (err) => {
    if (err) console.error("Error creating table:", err.message);
  }
);

// ✅ Route to remove duplicates (call once after deployment)
app.delete("/cleanup-duplicates", (req, res) => {
  const query = `
    DELETE FROM movies
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM movies
      GROUP BY movie_name
    );
  `;
  db.run(query, function (err) {
    if (err) {
      console.error("❌ Error deleting duplicates:", err.message);
      return res.status(500).send("Error cleaning duplicates");
    }
    res.send(`✅ Duplicate cleanup complete. ${this.changes} rows deleted.`);
  });
});

// ✅ Upload Excel and insert movies (skip duplicates gracefully)
app.post("/upload-movies", upload.single("file"), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const moviesData = XLSX.utils.sheet_to_json(worksheet);

    if (!moviesData.length) {
      return res
        .status(400)
        .send("Excel file is empty or headers are incorrect");
    }

    const query = `INSERT INTO movies (
      movie_name, release_year, genre,
      actor, actress, side_actor, side_actress,
      song_name, movie_letter, song_letter,
      actor_letter, actress_letter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.serialize(() => {
      const stmt = db.prepare(query);

      moviesData.forEach((movie) => {
        const {
          movie_name,
          release_year,
          genre,
          actor,
          actress,
          side_actor = "",
          side_actress = "",
          song_name,
          movie_letter,
          song_letter,
          actor_letter,
          actress_letter,
        } = movie;

        stmt.run(
          [
            movie_name,
            release_year,
            genre,
            actor,
            actress,
            side_actor,
            side_actress,
            song_name,
            movie_letter,
            song_letter,
            actor_letter,
            actress_letter,
          ],
          (err) => {
            if (err) {
              if (err.message.includes("UNIQUE constraint failed")) {
                console.warn(`⚠️ Skipped duplicate movie: ${movie_name}`);
              } else {
                console.error("❌ Error inserting row:", err.message);
              }
            }
          }
        );
      });

      stmt.finalize((err) => {
        if (err) return res.status(500).send("Error inserting movies");
        res
          .status(200)
          .send("Movies uploaded successfully (duplicates skipped)!");
      });
    });
  } catch (error) {
    console.error("❌ Upload error:", error.message);
    res.status(500).send("Error processing file");
  }
});

// API to fetch all movies
app.get("/movies", (req, res) => {
  db.all("SELECT * FROM movies", [], (err, rows) => {
    if (err) {
      console.error("Error fetching movies:", err.message);
      return res.status(500).send("Error fetching movies");
    }
    res.json(rows);
  });
});

// Add a new movie manually
app.post("/movies", (req, res) => {
  const {
    movie_name,
    release_year,
    genre,
    actor,
    actress,
    side_actor = "",
    side_actress = "",
    song_name,
    movie_letter,
    song_letter,
    actor_letter,
    actress_letter,
  } = req.body;

  const query = `INSERT INTO movies 
    (movie_name, release_year, genre, actor, actress, side_actor, side_actress, song_name, movie_letter, song_letter, actor_letter, actress_letter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(
    query,
    [
      movie_name,
      release_year,
      genre,
      actor,
      actress,
      side_actor,
      side_actress,
      song_name,
      movie_letter,
      song_letter,
      actor_letter,
      actress_letter,
    ],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(409).send("Duplicate movie, skipping insert.");
        }
        console.error("Error inserting data:", err.message);
        return res.status(500).send("Error adding movie");
      }
      res.status(201).send(`Movie added with ID: ${this.lastID}`);
    }
  );
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
