const express = require('express')
const { default: makeWASocket, useSingleFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const fs = require('fs')

const app = express()
app.use(express.json())
app.use(express.static('public'))

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')

let sessions = {} // store temp sessions in memory

app.post('/pair', async (req, res) => {
    let { number } = req.body
    if (!number) return res.status(400).json({ error: 'Enter number with country code' })

    number = number.replace(/[^0-9]/g, '')
    const id = `session_${Date.now()}`
    const { state, saveState } = useSingleFileAuthState(`./temp/${id}.json`)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false
    })

    sock.ev.on('creds.update', saveState)
    sessions[id] = { sock, number }

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update

        if (connection === 'open') {
            await delay(3000)
            const creds = fs.readFileSync(`./temp/${id}.json`)
            const session = Buffer.from(creds).toString('base64')

            // SEND SESSION TO THE CONNECTED NUMBER
            const jid = number + '@s.whatsapp.net'
            const msg = `🔐 *𝗕𝗔𝗬𝗠𝗔𝗫 𝗦𝗘𝗦𝗦𝗜𝗢𝗡*\n\nYour Session ID:\n\`\`${session}\`\n\nCopy and paste this in SESSION_ID env\n\n⚠️ *Do not share with anyone*`

            await sock.sendMessage(jid, { text: msg })
            await sock.sendMessage(jid, { text: '✅ *BAYMAX-MD CONNECTED SUCCESSFULLY🤖*' })

            // cleanup
            setTimeout(() => {
                if (fs.existsSync(`./temp/${id}.json`)) fs.unlinkSync(`./temp/${id}.json`)
                sock.end()
                delete sessions[id]
            }, 10000)
        }
    })

    // Send pairing code
    await delay(3000)
    try {
        const code = await sock.requestPairingCode(number)
        res.json({
            status: 'success',
            code: code?.match(/.{1,4}/g)?.join('-'),
            message: 'Enter this code in WhatsApp > Linked Devices'
        })
    } catch(e) {
        res.json({ error: 'Failed to get pairing code. Check number.' })
    }
})

app.listen(process.env.PORT || 3000, () => console.log('Pairing Website Running'))