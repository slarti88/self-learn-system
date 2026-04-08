require('dotenv').config();
const express = require('express');
const cors = require('cors');

const subjectsRouter = require('./routes/subjects');
const progressRouter = require('./routes/progress');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/subjects', subjectsRouter);
app.use('/api', progressRouter);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
