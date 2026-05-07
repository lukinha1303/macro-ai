import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("macro_ai.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT,
    total_calories INTEGER,
    total_protein INTEGER,
    total_carbs INTEGER,
    total_fat INTEGER,
    summary TEXT,
    items TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT 'Usuário',
    goal_calories INTEGER DEFAULT 2000,
    weight REAL DEFAULT 70.0,
    height REAL DEFAULT 170.0
  );

  CREATE TABLE IF NOT EXISTS weight_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weight REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  INSERT OR IGNORE INTO user_profile (id, name) VALUES (1, 'Usuário');
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/meals", (req, res) => {
    const meals = db.prepare("SELECT * FROM meals ORDER BY created_at DESC").all();
    res.json(meals.map(m => ({
      ...m,
      items: JSON.parse(m.items as string)
    })));
  });

  app.post("/api/meals", (req, res) => {
    const { image_url, total_calories, total_protein, total_carbs, total_fat, summary, items } = req.body;
    const stmt = db.prepare(`
      INSERT INTO meals (image_url, total_calories, total_protein, total_carbs, total_fat, summary, items)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(image_url, total_calories, total_protein, total_carbs, total_fat, summary, JSON.stringify(items));
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/profile", (req, res) => {
    const profile = db.prepare("SELECT * FROM user_profile WHERE id = 1").get();
    res.json(profile);
  });

  app.put("/api/profile", (req, res) => {
    const { name, goal_calories, weight, height } = req.body;
    
    // Get current weight to see if it changed
    const current = db.prepare("SELECT weight FROM user_profile WHERE id = 1").get() as { weight: number };
    
    db.prepare("UPDATE user_profile SET name = ?, goal_calories = ?, weight = ?, height = ? WHERE id = 1")
      .run(name, goal_calories, weight, height);
    
    // Log weight if it changed or if there are no logs yet
    const logs = db.prepare("SELECT count(*) as count FROM weight_history").get() as { count: number };
    if (logs.count === 0 || current.weight !== weight) {
      db.prepare("INSERT INTO weight_history (weight) VALUES (?)").run(weight);
    }
    
    res.json({ success: true });
  });

  app.get("/api/weight-history", (req, res) => {
    const history = db.prepare("SELECT * FROM weight_history ORDER BY created_at ASC").all();
    res.json(history);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
