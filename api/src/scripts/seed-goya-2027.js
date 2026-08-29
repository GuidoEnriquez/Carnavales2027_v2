import "dotenv/config";
import { closePool } from "../db/pool.js";
import { seedGoya2027 } from "../db/seeds/goya-2027.js";

try {
  await seedGoya2027();
  console.log("Goya 2027 seeded");
} finally {
  await closePool();
}
