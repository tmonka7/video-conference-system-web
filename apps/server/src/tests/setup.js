import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Must be set before any module reads the validated config.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdefghij';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdefghij';
process.env.BCRYPT_ROUNDS = '4';
process.env.APP_PUBLIC_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = 'uploads-test';

let mongo;

beforeAll(async () => {
  // Matches the MongoDB version the project targets.
  mongo = await MongoMemoryServer.create({ binary: { version: '5.0.22' } });
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  // Each test starts from an empty database rather than a fresh server.
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
