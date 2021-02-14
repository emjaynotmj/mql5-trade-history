const csv = require('csvtojson');
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 3001

app.use(express.json());

app.get('/api/read', async (req, res, next) => {
  try {
    const jsonArray = await csv({ delimiter: ';' }).fromFile(__dirname + '/891349.history.csv');
    res.send(jsonArray);
  } catch (err) {
    res.status(400).send(err);
  }
});

app.post('/api/upload', upload.single('csvFile'), async (req, res, next) => {
  try {
    const jsonArray = await csv({ delimiter: ';' }).fromFile(req.file.path);
    res.send(jsonArray);
  } catch (err) {
    res.status(400).send(err);
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(__dirname + '/build'));

  app.get('*', (req, res) => {
    res.sendFile(__dirname + '/build/index.html');
  });
}

app.listen(port, () => console.log('server started on ', port));