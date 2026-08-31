require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`QR router admin listening on port ${PORT}`);
});
