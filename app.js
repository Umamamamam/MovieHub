// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// env
const api = process.env.API_KEY;
const mongoURI = process.env.MONGODB_URI;

if (!api) console.error('Warning: API_KEY is not set');
if (!mongoURI) console.error('Warning: MONGODB_URI is not set');

// -----------------------------
// Serverless-friendly mongoose cache
// -----------------------------
let cached = global._mongooseCache || { conn: null, promise: null };
if (!global._mongooseCache) global._mongooseCache = cached;

async function connectToMongo() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoURI, {
      // optional mongoose options
    }).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// attempt initial connect (cold start)
if (mongoURI) {
  connectToMongo()
    .then(() => console.log('MongoDB connected (cold start)'))
    .catch(err => console.error('MongoDB cold start error:', err));
}

// -----------------------------
// Middleware & view setup
// -----------------------------
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// -----------------------------
// Schema & Model
// -----------------------------
const mongooseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  starring: { type: [String], default: [] },
  director: { type: String, required: true, trim: true },
  genre: { type: String, trim: true },
  language: { type: String, trim: true },
  image: { type: String },
  likes: { type: Number, default: 0 }
});
const Movie = mongoose.models.Film || mongoose.model('Film', mongooseSchema);

// -----------------------------
// Routes
// -----------------------------
app.get('/', async (req, res) => {
  try {
    if (!cached.conn) await connectToMongo();
    const films = await Movie.find({});
    res.render('index', { films });
  } catch (err) {
    console.error('Error in / route:', err);
    res.status(500).send('Server error');
  }
});

app.get('/movieDetail/:id', async (req, res) => {
  try {
    if (!cached.conn) await connectToMongo();
    const film = await Movie.findById(req.params.id);
    res.render('movieDetail', { film });
  } catch (err) {
    console.error('Error in /movieDetail/:id:', err);
    res.status(500).send('Server error');
  }
});

// Fetch from TMDB (uses global fetch on Node 18+)
app.get('/movieDetails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!api) return res.status(500).send('Missing API key');
    const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${api}&language=en-US`);
    if (!response.ok) {
      console.log('TMDB error status:', response.status);
      return res.status(500).send('Error fetching movie details');
    }
    const film = await response.json();
    res.render('movieDetail', { film });
  } catch (err) {
    console.error('ERROR in /movieDetails/:id route:', err);
    res.status(500).send('Server error');
  }
});

// Suggest (autocomplete) - GET ?query=...
app.get('/suggest', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.json({ movies: [] });
    if (!api) return res.json({ movies: [] });

    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${api}&query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    const movies = (data.results || []).slice(0, 5).map(m => ({
      title: m.title,
      release_date: m.release_date
    }));
    return res.json({ movies });
  } catch (e) {
    console.error('ERROR in /suggest:', e);
    return res.json({ movies: [] });
  }
});

// Search (POST)
app.post('/search', async (req, res) => {
  try {
    const { text } = req.body;
    let movies = [];

    if (api && text) {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${api}&query=${encodeURIComponent(text)}`
      );
      if (response.ok) {
        const data = await response.json();
        movies = data.results || [];
      }
    }

    if (!movies || movies.length === 0) {
      if (!cached.conn) await connectToMongo();
      movies = await Movie.find({}).limit(5);
    }

    console.log('SEARCH returned', movies.length, 'items');
    return res.json({ movies });
  } catch (e) {
    console.error('ERROR in /search:', e);
    if (!cached.conn) await connectToMongo();
    const movies = await Movie.find({}).limit(5);
    return res.json({ movies });
  }
});

// Like route (fixed)
app.post('/like/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { count } = req.body;
    if (!cached.conn) await connectToMongo();
    await Movie.findByIdAndUpdate(id, { $inc: { likes: count || 1 } });
    return res.json({ success: true });
  } catch (e) {
    console.error('ERROR in like route:', e);
    return res.status(500).json({ success: false });
  }
});

// -----------------------------
// local server (only when running app.js directly)
// -----------------------------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
