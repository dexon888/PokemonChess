import { listen } from "@colyseus/tools";
import app from "./app.config.js";

const port = Number(process.env.PORT ?? 2567);
await listen(app, port);
