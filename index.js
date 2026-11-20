import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const client = new MongoClient(
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b8dfpo9.mongodb.net/`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const database = connectedClient.db("hireloopdb");
const users = database.collection("user");
const jobs = database.collection("jobs");
const companies = database.collection("companies");
const applications = database.collection("applications");
const bookmarks = database.collection("bookmarks");
const payments = database.collection("payments");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Users related api

app.get("/users", async (req, res) => {
  const cursor = users.find({});
  const result = await cursor.toArray();
  res.send(result);
});

app.get('/users/:id/premium', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await users.findOne(query, { projection: { premium: 1 } });
  res.send(result);
})

// jobs related apis

app.get("/jobs", async (req, res) => {
  try {
    const query = {};

    // 1. Category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    // 2. Job type filter (supports multiple checkboxes)
    if (req.query.jobType) {
      const types = Array.isArray(req.query.jobType)
        ? req.query.jobType
        : [req.query.jobType];

      query.jobType = { $in: types };
    }

    // 3. Remote filter
    if (req.query.isRemote) {
      query.isRemote = req.query.isRemote === "true";
    }

    // 4. Search filter
    if (req.query.search) {
      const search = String(req.query.search).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { requirements: { $regex: search, $options: "i" } },
      ];
    }

    // 5. Get matching jobs from MongoDB
    let result = await jobs.find(query).toArray();

    // 6. Minimum salary filter
    if (req.query.minSalary) {
      result = result.filter(
        (job) => Number(job.minSalary) >= Number(req.query.minSalary),
      );
    }

    // 7. Maximum salary filter
    if (req.query.maxSalary) {
      result = result.filter(
        (job) => Number(job.maxSalary) <= Number(req.query.maxSalary),
      );
    }

    // 8. Salary frequency filter
    if (req.query.salaryFrequency) {
      result = result.filter(
        (job) =>
          (job.salaryFrequency || job.frequency) === req.query.salaryFrequency,
      );
    }

    // 9. Get all jobs for sidebar categories and counts
    const allJobs = await jobs.find().toArray();

    const categories = [
      ...new Set(allJobs.map((job) => job.category).filter(Boolean)),
    ].sort();

    const jobTypeCounts = {};

    allJobs.forEach((job) => {
      if (job.jobType) {
        jobTypeCounts[job.jobType] = (jobTypeCounts[job.jobType] || 0) + 1;
      }
    });

    // 10. Send everything in one response
    res.json({
      jobs: result,
      filterOptions: {
        categories,
        jobTypeCounts,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

app.post("/jobs", async (req, res) => {
  const job = req.body;
  const result = await jobs.insertOne(job);
  res.send(result);
});

app.get("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  const result = await jobs.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

app.patch("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  const { _id, ...data } = req.body;

  const result = await jobs.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );

  res.json(result);
});

app.delete("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobs.deleteOne(query);
  res.send(result);
});

// Company related api
app.get("/companies", async (req, res) => {
  const cursor = companies.find();
  const result = await cursor.toArray();
  res.send(result);
});

app.post("/companies", async (req, res) => {
  const company = req.body;
  const result = await companies.insertOne(company);
  res.send(result);
});

app.get("/companies/:id", async (req, res) => {
  const { id } = req.params;
  const result = await companies.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

app.patch("/companies/:id", async (req, res) => {
  const { id } = req.params;
  const { _id, ...data } = req.body;

  const result = await companies.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );

  res.json(result);
});

// application related apis
app.get("/applications", async (req, res) => {
  const query = {};

  if (req.query.applicantId) {
    query.userId = req.query.applicantId;
  }

  const cursor = applications.find(query);
  const result = await cursor.toArray();
  res.send(result);
});

app.get('/applications/count', async (req, res) => {
  const query = {};
  if (req.query.applicantId) {
    query.userId = req.query.applicantId;
  }
  const result = await applications.countDocuments(query);
  res.send({ count: result });
})

app.post("/applications", async (req, res) => {
  const application = req.body;
  const result = await applications.insertOne(application);
  res.send(result);
});


// bookmarks related apis

// 1. Get bookmarks (optionally filter by userId)
app.get("/bookmarks", async (req, res) => {
  const query = {};

  if (req.query.applicantId) {
    query.userId = req.query.applicantId;
  }

  const result = await bookmarks.find(query).toArray();
  res.send(result);
});

// 2. Add a bookmark
app.post("/bookmarks", async (req, res) => {
  const bookmark = req.body;
  const result = await bookmarks.insertOne(bookmark);
  res.send(result);
});

// 3. Remove a bookmark
app.delete("/bookmarks/:id", async (req, res) => {
  const id = req.params.id;

  const result = await bookmarks.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

// Payments realted api
app.post('/payments/checkout-verify', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.send({ success: false, message: 'Session ID is required' });
  }

  const {
    status,
    payment_status,
    customer_email,
    metadata,
    payment_intent,
  } = await stripe.checkout.sessions.retrieve(sessionId);

  // 1. is used new session 
  // 2. check is the session id for the currently logged in user
  // 3. insert sessionId into the payment Collection
  // 4. update user information as premium user

  if (status === 'complete' && payment_status === 'paid') {

    const sessionQuery = { sessionId };
    const existingPayment = await payments.findOne(sessionQuery);
    if (existingPayment) {
      return res.send({ success: false, message: 'Payment already verified' });
    }
    const payment = {
      sessionId,
      status,
      payment_status,
      customer_email,
      userId: metadata.userId,
      payment_date: new Date(),
      payment_intent,
    }

    const result = await payments.insertOne(payment);

    // update the user table
    const query = { _id: new ObjectId(metadata.userId) };

    const updatedDoc = {
      $set: {
        premium: true,
      }
    }
    const updateResult = await users.updateOne(
      query,
      updatedDoc
    );
    res.send({ success: true, result, updateResult });
    return
  }
  res.send({ success: false, message: 'Payment verification failed' });
})

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
