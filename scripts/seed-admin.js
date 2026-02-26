/* eslint-disable no-console */
require("dotenv").config();

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const MONGO = process.env.MONGODB_URI;
const EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const PASS  = String(process.env.ADMIN_PASSWORD || "");
const NAME  = String(process.env.ADMIN_NAME || "Admin").trim();
const ROLE  = String(process.env.ADMIN_ROLE || "admin").trim();
const SET_VERIFIED = String(process.env.ADMIN_VERIFIED || "true").toLowerCase() !== "false";

if (!MONGO) {
  console.error("❌ MONGODB_URI fehlt");
  process.exit(1);
}
if (!EMAIL) {
  console.error("❌ ADMIN_EMAIL fehlt");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db("autovisa");
  const nutzer = db.collection("nutzer");

  const existing = await nutzer.findOne({ email: EMAIL });
  const now = new Date();

  if (existing) {
    const update = { $set: { role: ROLE, email: EMAIL } };
    if (NAME && !existing.name) update.$set.name = NAME;
    if (SET_VERIFIED) update.$set.verified = true;

    if (PASS) {
      const hash = await bcrypt.hash(PASS, 12);
      update.$set.password = hash;
      update.$unset = { token: "", resetToken: "", resetTokenExpires: "" };
    }

    await nutzer.updateOne({ _id: existing._id }, update);
    console.log(`✅ Admin aktualisiert: ${EMAIL}`);
  } else {
    if (!PASS) {
      console.error("❌ ADMIN_PASSWORD fehlt (neuer Admin benötigt Passwort)");
      process.exit(1);
    }
    const hash = await bcrypt.hash(PASS, 12);
    const token = crypto.randomBytes(20).toString("hex");

    const doc = {
      id: Date.now().toString(),
      name: NAME || "Admin",
      email: EMAIL,
      password: hash,
      verified: SET_VERIFIED,
      token: SET_VERIFIED ? "" : token,
      role: ROLE,
      createdAt: now
    };

    await nutzer.insertOne(doc);
    console.log(`✅ Admin angelegt: ${EMAIL}`);
  }

  await client.close();
}

run().catch((err) => {
  console.error("❌ Seed fehlgeschlagen:", err);
  process.exit(1);
});
