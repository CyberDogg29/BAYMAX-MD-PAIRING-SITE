const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys')
const path = require('path')
const fs = require('fs')
const pino = require('pino')

const app = express()
app.use(express.json())
app.use(express.static('public'))

app.post('/pair', async (req, res) => {
    const { number } = req.body
    if (!number) return res.status(400).json({ error: 'Enter number' })

    const cleanNumber = number.replace(/[^0-9]/g, '')
    const sessionPath = `./temp/${cleanNumber}`
    if(!fs.existsSync('./temp')) fs.mkdirSync('./temp')

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' })
        })

        sock.ev.on('creds.update', saveCreds)

        const code = await sock.requestPairingCode(cleanNumber)
        
        res.json({
            status: 'success',
            code: code.match(/.{1,4}/g).join('-')
        })

        sock.ev.on('connection.update', async (u) => {
            if(u.connection === 'open'){
                await new Promise(r => setTimeout(r, 2000))
                const creds = fs.readFileSync(path.join(sessionPath, 'creds.json'))
                const session = Buffer.from(creds).toString('base64')
                const jid = cleanNumber + '@s.whatsapp.net'
                
                await sock.sendMessage(jid, { 
                    text: `🔐 *BAYMAX-MD SESSION*\n\nYour Session ID:\n\`\`${session}\`\n\nPaste in SESSION_ID\n⚠️ Do not share` 
                })
                await sock.sendMessage(jid, { text: '✅ *BAYMAX-MD CONNECTED SUCCESSFULLY*' })
                sock.end()
                fs.rmSync(sessionPath, { recursive: true, force: true })
            }
            if(u.connection === 'close'){
                fs.rmSync(sessionPath, { recursive: true, force: true })
            }
        })

    } catch(e){
        res.status(500).json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on ${PORT}`))
