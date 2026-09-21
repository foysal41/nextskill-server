// =====================================
// MongoDB
// =====================================
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_DB_URI;

if (!uri) {
  console.error("MONGO_DB_URI is missing");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let courseCollections;


// =====================================
// MongoDB Connection
// =====================================

async function connectDB() {
  if (courseCollections) {
    return courseCollections;
  }

  await client.connect();

  const database = client.db("nextSkill_Course_db");

  courseCollections = database.collection("courses");

  await client.db("admin").command({ ping: 1 });

  console.log("MongoDB connected successfully!");

  return courseCollections;
}