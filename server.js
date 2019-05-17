const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const GridFSStorage = require("multer-gridfs-storage");
const multer = require("multer");

//mongoose.Promise = global.Promise;

const app = express();
const port = 3000;

// Allows cross-origin domains to access this API
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type,Content-Length, Content-Length,Content-Range, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, GET, PATCH, DELETE, OPTIONS"
  );
  next();
});

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose.connect("mongodb://localhost/flashtool", { useNewUrlParser: true });
const conn = mongoose.connection;

conn.on("error", console.error.bind(console, "connection error:"));

conn.once("open", () => {
  console.log("Successfully connected to mongoDB!");

  const storage = new GridFSStorage({
    db: conn,
    file: (req, file) => {
      return {
        filename: file.originalname
      };
    }
  });

  const upload = multer({ storage: storage });
  const bucket = new mongoose.mongo.GridFSBucket(conn.db);

  storage.on("file", file => {
    console.log("A new file was uploaded!");
  });

  app.get("/", (req, res) => {
    res.render("index");
  });

  app.get("/api/files", (req, res) => {
    bucket.find({}).toArray((error, files) => {
      if (error) {
        res.json({
          error: error
        });
      } else {
        res.json({
          message: "These are all files found in the database",
          files: files
        });
      }
    });
  });

  app.get("/api/firmwares", (req, res) => {
    bucket
      .find({ contentType: "application/x-zip-compressed" })
      .toArray((error, files) => {
        if (error) {
          res.json({
            error: error
          });
        } else {
          res.json({
            message: "These are all firmwares found in the database",
            files: files
          });
        }
      });
  });

  app.get("/api/files/fileinfo", (req, res) => {
    if (!req.query.filename) {
      res.json({ message: "no filename provided" });
    } else {
      bucket.find({ filename: req.query.filename }).toArray((error, files) => {
        if (error) {
          res.json({
            error: error
          });
        } else if (files.length == 0) {
          res.sendStatus(404).json({ message: "not found!" });
        } else {
          res.json(files[0]);
        }
      });
    }
  });

  app.post("/upload", upload.single("firmware-zip"), (req, res) => {
    res.redirect("/api/firmwares");
  });

  app.get("/download", (req, res) => {
    let filename;
    if (req.query.filename) {
      filename = req.query.filename;
      bucket.find({ filename: filename }).toArray((error, files) => {
        if (error) {
          res.json({ error: error });
        } else if (files.length == 0) {
          res.sendStatus(404).json({ message: "file not found!" });
        } else {
          let downloadStream = bucket.openDownloadStream(files[0]._id);
          downloadStream.on("error", err => {
            console.log(err);
          });
          downloadStream.pipe(res);
        }
      });
    } else {
      console.log("Invalid query");
      res.sendStatus(404);
    }
  });

  app.listen(port, () => {
    console.log(`Flash-tool server listening on port ${port}!`);
  });
});
