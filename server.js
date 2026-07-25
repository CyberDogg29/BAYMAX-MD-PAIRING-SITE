import express from "express";
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, requestPairingCode } from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // serves index.html + bg.jpg

app.post('/pair', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: "Number required" });

  const sessionId = `session_${Date.now()}`;
  const authPath = `./auth/${sessionId}`;
  fs.mkdirSync(authPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  try {
    await delay(1500);
    const code = await requestPairingCode(sock, number);
    res.json({ code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get pairing code" });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
