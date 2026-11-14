import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

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

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/users", async (req, res) => {
  const cursor = users.find({});
  const result = await cursor.toArray();
  res.send(result);
});

// jobs related apis
app.get("/jobs", async (req, res) => {
  const query = {};

  // Job type: supports one or multiple selected checkboxes.
  if (req.query.jobType) {
    const types = Array.isArray(req.query.jobType)
      ? req.query.jobType
      : [req.query.jobType];

    query.jobType = {
      $in: types.filter((type) => typeof type === "string"),
    };
  }

  // Category.
  if (typeof req.query.category === "string") {
    query.category = req.query.category;
  }

  // Remote.
  if (req.query.isRemote === "true" || req.query.isRemote === "false") {
    query.isRemote = req.query.isRemote === "true";
  }

  // Search by title, company name, or location.
  if (typeof req.query.search === "string") {
    const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { companyName: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { requirements: { $regex: search, $options: "i" } },
    ];
  }

  const result = await jobs.find(query).toArray();
  res.send(result);
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
