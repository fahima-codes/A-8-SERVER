import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8000;

const AUTH_URL = process.env.BETTER_AUTH_URL;
if (!AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is missing from .env');
}

const authUrl = AUTH_URL.replace(/\/$/, '');
const JWKS = createRemoteJWKSet(new URL('/api/auth/jwks', `${authUrl}/`));

app.use(cors());
app.use(express.json());

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  throw new Error('MONGODB_URL is missing from .env');
}

const client = new MongoClient(mongoUrl);

let studioCollection;
let bookingCollection;

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    return res.status(401).send({ msg: 'Missing Bearer token' });
  }

  try {
    await jwtVerify(token, JWKS, {
      issuer: authUrl,
      audience: authUrl,
    });

    console.log('JWT verified successfully');
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(401).send({ msg: 'Invalid or expired token' });
  }
};

async function startServer() {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db('assaingment-8');
    studioCollection = db.collection('studios');
    bookingCollection = db.collection('bookings');

    app.post('/add-studio', verifyToken, async (req, res) => {
      try {
        const result = await studioCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });

        res.status(201).send({
          message: 'Studio added',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error('Failed to save studio:', error);
        res.status(500).send({ message: 'Failed to save studio' });
      }
    });

    app.get('/studios', async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { hostEmail: email } : {};
        const studios = await studioCollection.find(query).toArray();

        res.send(studios);
      } catch (error) {
        console.error('Failed to load studios:', error);
        res.status(500).send({ message: 'Failed to load studios' });
      }
    });

    app.get('/studios/:id', verifyToken, async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid ID' });
        }

        console.log('Looking for studio ID:', req.params.id);

        const studio = await studioCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        console.log('Studio found:', Boolean(studio));

        if (!studio) {
          return res.status(404).send({ message: 'Studio not found' });
        }

        res.send(studio);
      } catch (error) {
        console.error('Failed to load studio:', error);
        res.status(500).send({ message: 'Failed to load studio' });
      }
    });

    app.patch('/studios/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid ID' });
        }

        const { _id, hostEmail, hostName, ...updateData } = req.body;

        const result = await studioCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData },
        );

        res.send({ message: 'Studio updated', result });
      } catch (error) {
        console.error('Failed to update studio:', error);
        res.status(500).send({ message: 'Failed to update studio' });
      }
    });

    app.delete('/studios/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid ID' });
        }

        const result = await studioCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send({ message: 'Studio deleted', result });
      } catch (error) {
        console.error('Failed to delete studio:', error);
        res.status(500).send({ message: 'Failed to delete studio' });
      }
    });

    app.post('/bookings', async (req, res) => {
      try {
        const result = await bookingCollection.insertOne({
          ...req.body,
          status: req.body.status || 'Pending',
          createdAt: new Date(),
        });

        res.status(201).send(result);
      } catch (error) {
        console.error('Failed to create booking:', error);
        res.status(500).send({ message: 'Failed to book' });
      }
    });

    app.get('/bookings', async (req, res) => {
      try {
        const { email, hostEmail, studioId } = req.query;
        let query = {};

        if (email) {
          query.userEmail = email;
        } else if (studioId) {
          if (!ObjectId.isValid(studioId)) {
            return res.status(400).send({ message: 'Invalid studio ID' });
          }

          query.studioId = studioId;
        } else if (hostEmail) {
          const hostStudios = await studioCollection
            .find({ hostEmail })
            .project({ _id: 1 })
            .toArray();

          const ids = hostStudios.map(studio => studio._id.toString());
          query.studioId = { $in: ids };
        }

        const bookings = await bookingCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(bookings);
      } catch (error) {
        console.error('Failed to load bookings:', error);
        res.status(500).send({ message: 'Failed to load bookings' });
      }
    });

    app.patch('/bookings/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid ID' });
        }

        const allowedStatuses = [
          'Pending',
          'Confirmed',
          'Completed',
          'Cancelled',
        ];

        if (req.body.status && !allowedStatuses.includes(req.body.status)) {
          return res.status(400).send({ message: 'Invalid status' });
        }

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: req.body.status } },
        );

        res.send({ message: 'Booking updated', result });
      } catch (error) {
        console.error('Failed to update booking:', error);
        res.status(500).send({ message: 'Failed to update booking' });
      }
    });

    app.delete('/bookings/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid ID' });
        }

        const result = await bookingCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);
      } catch (error) {
        console.error('Failed to delete booking:', error);
        res.status(500).send({ message: 'Failed to cancel' });
      }
    });

    app.get('/', (req, res) => {
      res.send({ message: 'Server is running fine!' });
    });

    app.use((error, req, res, next) => {
      console.error(error);
      res.status(500).send({ message: 'Internal server error' });
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    await client.close();
    process.exit(1);
  }
}

startServer();
