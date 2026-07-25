const { default: makeWASocket, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys')
const { useMultiFileAuthState } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

export default async function handler(req, res) {
    if(req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'})
    
    const { number } = req.body
    if (!number) return res.status(400).json({ error: 'Enter number with country code' })

    const cleanNumber = number.replace(/[^0-9]/g, '')
    const sessionId = `session_${Date.now()}`
    const sessionPath = path.join('/tmp', sessionId)

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: require('pino')({ level: 'silent' })
        })

        sock.ev.on('creds.update', saveCreds)

        let pairingCode = null
        await new Promise(async (resolve) => {
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update
                
                if (connection === 'connecting' && !pairingCode) {
                    try {
                        pairingCode = await sock.requestPairingCode(cleanNumber)
                        resolve()
                    } catch {
                        resolve()
                    }
                }

                if (connection === 'open') {
                    await new Promise(r => setTimeout(r, 2000))
                    const creds = fs.readFileSync(path.join(sessionPath, 'creds.json'))
                    const session = Buffer.from(creds).toString('base64')

                    const jid = cleanNumber + '@s.whatsapp.net'
                    await sock.sendMessage(jid, { 
                        text: `🔐 *BAYMAX-MD SESSION*\n\nYour Session ID:\n\`\`\`${session}\`\`\`\n\nPaste this in SESSION_ID on Railway/Panel\n\n⚠️ Do not share with anyone` 
                    })
                    await sock.sendMessage(jid, { text: '✅ *BAYMAX-MD CONNECTED SUCCESSFULLY*' })
                    sock.end()
                    fs.rmSync(sessionPath, { recursive: true, force: true })
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                    if (!shouldReconnect) fs.rmSync(sessionPath, { recursive: true, force: true })
                }
            })
        })

        if(pairingCode) {
            return res.status(200).json({
                status: 'success',
                code: pairingCode.match(/.{1,4}/g).join('-'),
                message: 'Enter this code in WhatsApp > Linked Devices. Session will be sent to your WhatsApp once connected.'
            })
        } else {
            return res.status(500).json({ error: 'Failed to get pairing code. Check number format +263...' })
        }

    } catch (e) {
        return res.status(500).json({ error: e.message })
    }
              } 
