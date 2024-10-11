const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');

const multer = require('multer');
const fs = require('fs');

require('dotenv').config();
const app = express();
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'fasefraw4r5r3wq45wdfgw34twdfg';

app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(__dirname + '/uploads'));


app.use(cors({
  credentials: true,
  origin: 'http://localhost:5173',
}));

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get('/api/test', (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  return res.json('test ok');
});

app.post('/api/register', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }

});

app.post('/api/login', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({
        email: userDoc.email,
        id: userDoc._id
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json(userDoc);
      });
    } else {
      res.status(422).json('pass not ok');
    }
  } else {
    res.json('not found');
  }
});

app.get('/api/profile', (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '').json(true);
});



app.post('/api/upload-by-link', async (req, res) => {

  try {
    const { imageURL } = req.body
    let newName = 'airbnb' + Date.now() + '.jpg'
    const options = {
      url: imageURL,
      dest: __dirname + '/uploads/' + newName,
    }
    await imageDownload.image(options)
    res.json(newName)
  } catch (err) {
    res.status(404).send('Failed to upload the image')
  }

});


const photosMiddleware = multer({ dest: 'uploads/' })

app.post('/api/upload', photosMiddleware.array('photos', 100), async (req, res) => {

  try {
    const uploadedFiles = []
    for (let i = 0; i < req.files.length; i++) {
      const { path } = req.files[i]

      // creating new file for saving it into the uploads file
      let newFileName = 'airbnb' + Date.now() + '.jpg'
      fs.renameSync(path, __dirname + '/uploads/' + newFileName) // renaming file with new name
      uploadedFiles.push(newFileName) // stroing new name in an array and this will send to client, by using this name client can access the photo
    }
    res.json(uploadedFiles)
  } catch (err) {
    res.status(404).json('Failed to upload the image')
  }
});

app.post('/api/places', (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id, price,
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
    });
    res.json(placeDoc);
  });
});

app.get('/api/user-places', (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get('/api/places/:id', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  try {
    const { id } = req.params
    const placeById = await Place.findOne({ _id: id }) // fetching the place details using id
    res.json(placeById)
  } catch (error) {
    res.status(400).json({ err: error.message })
  }
});

app.put('/api/places', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    id, title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos: addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/api/places', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  res.json(await Place.find());
});


app.post('/api/bookings', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
  } = req.body;
  Booking.create({
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
    user: userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});

app.get('/api/bookings', async (req, res) => {
  mongoose.set("strictQuery", false);
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate('place'));
});

app.listen(4000);