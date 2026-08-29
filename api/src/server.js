import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import { createApp } from "./app.js";
import { auth } from "./auth/auth.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp({ authHandler: toNodeHandler(auth) });

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
