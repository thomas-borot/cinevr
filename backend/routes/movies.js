const express = require("express");
const MovieModel = require("../models/movie");
const RateModel = require("../models/rate");
const PredictionModel = require("../models/prediction");
const purgeMovie = require("../services/purgeMovie");
const populateDatabase = require("../services/populateMovieDatabase");
const indexMovie = require("../services/indexMovie").indexMovie;
const indexSearch = require("../services/indexMovie").indexSearch;
const router = express.Router();

router.get("/", function (req, res) {
  MovieModel.find({})
    .sort(req.query.sortBy)
    .skip(parseInt(req.query.skip))
    .limit(parseInt(req.query.limit))
    .then(function (movies) {
      res.json({ movies: movies });
    });
});

router.get("/show/:movieId", function (req, res) {
  MovieModel.findOne({ id: req.params.movieId }).then(function (movie) {
    res.json({ movie: movie });
  });
});

router.get("/search", function (req, res) {
  indexSearch(req.query.title, res);
});

router.delete("/delete", function (req, res) {
  purgeMovie(req.body.id);
  MovieModel.deleteOne({ id: req.body.id }, function (err) {
    if (err) res.status(500).json({ message: err });
    else
      res.status(201).json({
        message: `Successfully deleted movie with id ${req.body.id} !`,
      });
  });
});

router.post("/populate", function (req, res) {
  populateDatabase(req.body.pages);
  res.json({ message: "DONE" });
});

router.post("/add", function (req, res) {
  MovieModel.findOne({})
    .sort("id")
    .then((data) => {
      const newMovie = new MovieModel({
        id: Math.min(data.id - 1, -1),
        originalTitle: req.body.originalTitle,
        releaseDate: req.body.releaseDate,
        posterPath: req.body.posterPath,
        backdropPath: req.body.backdropPath,
        genreIds: req.body.genreIds,
        originalLanguage: req.body.originalLanguage,
        overview: req.body.overview,
        popularity: req.body.popularity,
        title: req.body.title,
        video: req.body.video,
        voteAverage: req.body.voteAverage,
        voteCount: req.body.voteCount,
      });

      newMovie
        .save()
        .then(function (newDocument) {
          indexMovie(
            newDocument.originalTitle,
            newDocument.overview,
            newDocument.id
          );
          res.status(201).json(newDocument);
        })
        .catch(function (error) {
          if (error.code === 11000) {
            res.status(400).json({
              message: `Movie with id ${newMovie.id} already exists`,
            });
          } else {
            res
              .status(500)
              .json({ message: error + " while creating the movie" });
          }
        });
    });
});

router.post("/edit", function (req, res) {
  MovieModel.findOneAndUpdate(
    { id: req.body.id },
    req.body,
    { useFindAndModify: false },
    function (err) {
      if (err) res.status(500).json({ message: err });
      else {
        indexMovie(req.body.originalTitle, req.body.overview, req.body.id);
        res.status(201).json(req.body);
      }
    }
  );
});

router.post("/rate", function (req, res) {
  const newRate = {
    userMoviePair: {
      userEmail: req.body.user,
      movieId: parseInt(req.body.movie),
    },
    userEmail: req.body.user,
    movieId: parseInt(req.body.movie),
    rate: parseInt(req.body.rate),
  };
  RateModel.findOneAndUpdate(
    {
      userMoviePair: {
        userEmail: req.body.user,
        movieId: parseInt(req.body.movie),
      },
    },
    newRate,
    { new: true, upsert: true, useFindAndModify: false },
    function (err) {
      if (err) res.status(500).json({ message: err });
      else res.status(201).json(newRate);
    }
  );
  MovieModel.findOne({ id: req.body.movie }).then((movie) => {
    MovieModel.findOneAndUpdate(
      { id: parseInt(req.body.movie) },
      {
        $set: {
          voteCount: movie.voteCount + 1,
          voteAverage:
            (movie.voteAverage * movie.voteCount + parseInt(req.body.rate)) /
            (movie.voteCount + 1),
        },
      },
      { useFindAndModify: false },
      function (err) {
        if (err) console.log(err);
        else console.log("Successfully updated rating");
      }
    );
  });
});

router.get("/rate", function (req, res) {
  let query = { userEmail: req.query.user, movieId: parseInt(req.query.movie) };
  console.log(query);
  RateModel.findOne({
    userMoviePair: query,
  }).then((rating, err) => {
    if (err) res.status(500).json(err);
    else if (rating) res.status(201).json({ rate: rating.rate });
    else res.status(202).json({ rate: 0 });
  });
});

router.get("/recommend", function (req, res) {
  let query = { userEmail: req.query.email };

  PredictionModel.find(query)
    .sort("-ratePredict")
    .limit(parseInt(req.query.limit))

    .then(async function (movies) {
      var count = movies.length;
      movies.forEach((movie) => {
        MovieModel.findOne({ id: movie.movieId }).then((movieDetails) => {
          Object.assign(movie, movie, movieDetails);

          count -= 1;
          if (count === 0) {
            res.json({ movies: movies });
          }
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

module.exports = router;
