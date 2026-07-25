Look at this

import express from "express";
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

// Home Page
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// API Status
app.get("/api", (req, res) => {
  res.status(200).json({
    status: "ok",
    name: "BAYMAX-MD Pairing API",
    version: "1.0.0"
  });
});

// Health Check
app.get("/api/healthz", (req, res) => {
  res.status(200).json({
    status: "healthy"
  });
});

// Pair Endpoint
app.post("/pair", async (req, res) => {
  try {
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({
        error: "WhatsApp number is required."
      });
    }

    const sessionId = `session_${Date.now()}`;
    const authDir = `./auth/${sessionId}`;

    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(authDir);

    const { version } =
      await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    await delay(2000);

    if (!sock.requestPairingCode) {
      return res.status(500).json({
        error: "Your Baileys version does not support pairing codes."
      });
    }

    const code = await sock.requestPairingCode(number);

    res.json({
      success: true,
      code
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate pairing code."
    });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 BAYMAX-MD running on port ${PORT}`);
});
