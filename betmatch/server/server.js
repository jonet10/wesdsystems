import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { initSocket } from "./socket/index.js";

dotenv.config();

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

initSocket(io);

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`BetMatch server running on port ${port}`);
});
