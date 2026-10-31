import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const mongoUrl = process.env.MONGODB_URL;

if (!mongoUrl) {
  throw new Error('MONGODB_URL is missing from the .env file');
}

const client = new MongoClient(mongoUrl);
let studioCollection;

async function startServer() {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db('assaingment-8');
    studioCollection = db.collection('studios');

    app.post('/add-studio', async (req, res) => {
      try {
        const result = await studioCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });

        res.status(201).send({
          message: 'Studio added successfully',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error('Failed to save studio:', error);
        res.status(500).send({ message: 'Failed to save studio' });
      }
    });

    app.get('/studios', async (req, res) => {
      try {
        const studios = await studioCollection.find().toArray();
        res.send(studios);
      } catch (error) {
        console.error('Failed to load studios:', error);
        res.status(500).send({ message: 'Failed to load studios' });
      }
    });

    app.get('/studios/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid studio ID' });
        }

        const studio = await studioCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!studio) {
          return res.status(404).send({ message: 'Studio not found' });
        }

        res.send(studio);
      } catch (error) {
        console.error('Failed to find studio:', error);
        res.status(500).send({ message: 'Failed to find studio' });
      }
    });

    app.patch('/studios/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid studio ID' });
        }

        const { _id, ...updateData } = req.body;

        const result = await studioCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Studio not found' });
        }

        res.send({
          message: 'Studio updated successfully',
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error('Failed to update studio:', error);
        res.status(500).send({ message: 'Failed to update studio' });
      }
    });

    app.delete('/studios/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: 'Invalid studio ID' });
        }

        const result = await studioCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Studio not found' });
        }

        res.send({ message: 'Studio deleted successfully' });
      } catch (error) {
        console.error('Failed to delete studio:', error);
        res.status(500).send({ message: 'Failed to delete studio' });
      }
    });

    app.get('/', (req, res) => {
      res.send({ message: 'Server is running fine!' });
    });

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Could not connect to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
