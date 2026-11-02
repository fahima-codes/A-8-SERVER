import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) throw new Error('MONGODB_URL is missing');

const client = new MongoClient(mongoUrl);
let studioCollection;
let bookingCollection;

async function startServer() {
  await client.connect();
  console.log('Successfully connected to MongoDB');

  const db = client.db('assaingment-8');
  studioCollection = db.collection('studios');
  bookingCollection = db.collection('bookings');

  // --- STUDIOS ---
  app.post('/add-studio', async (req, res) => {
    try {
      const result = await studioCollection.insertOne({
        ...req.body,
        createdAt: new Date(),
      });
      res
        .status(201)
        .send({ message: 'Studio added', insertedId: result.insertedId });
    } catch (e) {
      res.status(500).send({ message: 'Failed to save studio' });
    }
  });

  // Duplicate - chaile eta delete kore dite paro, client sudhu /add-studio use kore
  app.post('/studios', async (req, res) => {
    try {
      const result = await studioCollection.insertOne({
        ...req.body,
        createdAt: new Date(),
      });
      res
        .status(201)
        .send({ message: 'Studio added', insertedId: result.insertedId });
    } catch (e) {
      res.status(500).send({ message: 'Failed to save studio' });
    }
  });

  app.get('/studios', async (req, res) => {
    try {
      const email = req.query.email;
      const query = email ? { hostEmail: email } : {};
      const studios = await studioCollection.find(query).toArray();
      res.send(studios);
    } catch (e) {
      res.status(500).send({ message: 'Failed to load studios' });
    }
  });

  app.get('/studios/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: 'Invalid ID' });
      const studio = await studioCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!studio) return res.status(404).send({ message: 'Studio not found' });
      res.send(studio);
    } catch (e) {
      res.status(500).send({ message: 'Failed to load studio' });
    }
  });

  // FIXED #3: Crash bug + hostEmail overwrite fix
  app.patch('/studios/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: 'Invalid ID' });

      const { _id, hostEmail, hostName, ...updateData } = req.body; // hostEmail overwrite bondho
      const result = await studioCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData },
      );
      res.send({ message: 'Studio updated', result });
    } catch (e) {
      res.status(500).send({ message: 'Failed to update studio' });
    }
  });

  // FIXED #3: Crash bug
  app.delete('/studios/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: 'Invalid ID' });
      const result = await studioCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send({ message: 'Studio deleted', result });
    } catch (e) {
      res.status(500).send({ message: 'Failed to delete studio' });
    }
  });

  // --- BOOKINGS ---
  app.post('/bookings', async (req, res) => {
    try {
      const result = await bookingCollection.insertOne({
        ...req.body,
        status: req.body.status || 'Pending', // default status
        createdAt: new Date(),
      });
      res.status(201).send(result);
    } catch (e) {
      res.status(500).send({ message: 'Failed to book' });
    }
  });

  // FIXED #2: Host dekhte parbe + FIXED #1 support
  app.get('/bookings', async (req, res) => {
    try {
      const { email, hostEmail, studioId } = req.query;
      let query = {};

      if (email) {
        query.userEmail = email; // user er jonno
      } else if (studioId) {
        if (!ObjectId.isValid(studioId))
          return res.status(400).send({ message: 'Invalid studio ID' });
        query.studioId = studioId;
      } else if (hostEmail) {
        // host er sob studio ber koro, tarpor oi studio gulor booking
        const hostStudios = await studioCollection
          .find({ hostEmail })
          .project({ _id: 1 })
          .toArray();
        const ids = hostStudios.map(s => s._id.toString());
        // booking e studioId string hisebe save korle
        query.studioId = { $in: ids };
        // jodi ObjectId hisebe save koro tahole: query.studioId = { $in: hostStudios.map(s => s._id) };
      }

      const bookings = await bookingCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(bookings);
    } catch (e) {
      res.status(500).send({ message: 'Failed to load bookings' });
    }
  });

  // FIXED #1: Eta sobcheye important - status change
  app.patch('/bookings/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: 'Invalid ID' });

      const allowed = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
      if (req.body.status && !allowed.includes(req.body.status)) {
        return res.status(400).send({ message: 'Invalid status' });
      }

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: req.body.status } },
      );
      res.send({ message: 'Booking updated', result });
    } catch (e) {
      res.status(500).send({ message: 'Failed to update booking' });
    }
  });

  app.delete('/bookings/:id', async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: 'Invalid ID' });
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    } catch (e) {
      res.status(500).send({ message: 'Failed to cancel' });
    }
  });

  app.get('/', (req, res) => res.send({ message: 'Server is running fine!' }));

  // Global error handler - HTML 500 er bodole JSON
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send({ message: 'Internal server error' });
  });

  app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`),
  );
}

startServer();
