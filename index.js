import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb'; // <-- ObjectId add koro
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
      const result = await studioCollection.find().toArray();
      res.send(result);
    });

    // FIXED ROUTE - 100% kaj korbe
    app.get('/studios/:id', async (req, res) => {
      try {
        const id = req.params.id; // <-- req.params
        console.log('Finding ID:', id);
        const result = await studioCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: 'Studio not found' });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Invalid ID format' });
      }
    });

    app.patch('/studios/:id', async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await studioCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.json(result);
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
