import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
app.use(cors());
app.use(express.json());

await mongoose.connect(process.env.MONGODB_URI, { dbName: 'f1db' });
console.log('✅ MongoDB connected');

const Race = mongoose.model('Race', new mongoose.Schema({
  season: Number,
  round: Number,
  name: String,
  circuit: String,
  date: Date,
  location: String,
  winner: { code: String, name: String, team: String }
}, { versionKey: false }));

app.get('/api/races', async (req, res) => {
  const season = Number(req.query.season);
  const filter = Number.isFinite(season) ? { season } : {};
  const races = await Race.find(filter).sort({ round: 1 });
  res.json(races);
});

app.get('/', (_, res) => res.send('F1 API OK'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server http://localhost:${PORT}`));
