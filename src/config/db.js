// =====================================
// MongoDB
// =====================================

const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const {
  MongoClient,
  ServerApiVersion,
} = require("mongodb");

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

let database;


// =====================================
// MongoDB Connection
// =====================================

async function connectDB() {
  if (database) {
    return database;
  }

  await client.connect();

  database = client.db(
    "nextSkill_Course_db"
  );

  await client
    .db("admin")
    .command({ ping: 1 });

  console.log(
    "MongoDB connected successfully!"
  );

  return database;
}


// =====================================
// Export
// =====================================

module.exports = connectDB;