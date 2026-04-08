require('dotenv').config({path:__dirname + "/./../.env"});
const express = require('express');
const cors = require('cors');

const subjectsRouter = require('./routes/subjects');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/subjects', subjectsRouter);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
