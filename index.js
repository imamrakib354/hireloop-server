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
const applications = database.collection("applications");

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

app.post("/applications", async (req, res) => {
  const application = req.body;
  const result = await applications.insertOne(application);
  res.send(result);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
