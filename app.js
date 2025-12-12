require('dotenv').config();

const express = require('express')

const mongoose = require('mongoose')
const app =  express()


const api = process.env.API_KEY
const mongoURI = process.env.MONGODB_URI
mongoose.connect(mongoURI)

.then(() => {
    console.log("MongoDB Successfully connected")
})
.catch((e) => {
    console.log(e,"error")
})
app.use(express.json())
app.use(express.static('public'))

app.set('view engine', 'ejs')
app.set('views', './views')

const mongooseSchema = new mongoose.Schema({
      title: {
    type: String,
    required: true,
    trim: true
  },

  year: {
    type: Number,
    required: true
  },

  starring: {
    type: [String],   // array of strings
    default: []
  },

  director: {
    type: String,
    required: true,
    trim: true
  },

  genre: {
    type: String,
    trim: true
  },

  language: {
    type: String,
    trim: true
  },

  // storing base64 image string
  image: {
    type: String       // "data:image/jpeg;base64,...."
  }

})
const Movie = mongoose.model('Film', mongooseSchema)

app.get('/', async (req, res) =>{
    const films = await Movie.find({})
    res.render('index', {films})
})

app.get('/movieDetail/:id', async (req, res) => {
    const { id } = req.params
    const film = await Movie.findById(id)
    res.render('movieDetail', {film})
})

app.get('/movieDetails/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${api}&language=en-US`
    );

    if (!response.ok) {
      console.log("TMDB error status:", response.status);
      return res.status(500).send("Error fetching movie details");
    }

    const film = await response.json();
    res.render('movieDetail', { film });

  } catch (err) {
    console.error("ERROR in /movieDetails/:id route:", err);
    res.status(500).send("Server error");
  }
});


app.post('/suggest', async (req, res) => {
  const {query} = req.query.query;
     if (!query) {
      return res.json({ movies: [] });
    }
  try{
    const response = await  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${api}&query=${query}`)
    const data = await response.json()
    const movies = (data.results || []).slice(0,5).map((m) => ({
      title: m.title,
      release_data: m.release_date
    }))
    return res.json({movies})
  }
  catch(e) {
    console.log(e, 'ERROR') 
  }
})

app.post('/search', async (req, res) => {
  const { text } = req.body;
  let movies = [];

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${api}&query=${text}`
    );

    if (response.ok) {
      const data = await response.json();
      movies = data.results;
    }

  
    if (!movies || movies.length === 0) {
      movies = await Movie.find({}).limit(5);
    }
    console.log(movies, "MOVIES");
    return res.json({ movies });

  } catch (e) {
    console.log(e, "ERROR");
    const movies = await Movie.find({}).limit(5);
    return res.json({ movies });
  }
});

app.post('/like/:id', async (req, res) => {
  const { id } = req.params;
  const { count } = req.body;
  try {
    await findByIdAndUpdate(id, { $inc: { likes: count } });
  }
catch(e) {
    console.log(e, "ERROR in like route");  
}
})

// app.listen(3000, () => {
//     console.log("Server is running on 3000");
// })

module.exports = app; 