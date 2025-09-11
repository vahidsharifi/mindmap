const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Temporary app - to be deleted');
});

app.listen(PORT, () => {
  console.log(`Temporary app listening on port ${PORT}`);
});