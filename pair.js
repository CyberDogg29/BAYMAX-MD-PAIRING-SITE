const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { toFile } = require('buffer')

export default async function handler(req, res) {
    if(req.method!== 'POST') return res.status(405).end()
    
    const { number } = req.body
    if (!number) return res.status(400).json({ error: 'Enter number' })

    try {
        const { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`/tmp`) // /tmp works on vercel
        
        const sock = makeWASocket({ auth: state, version, printQRInTerminal: false })
        sock.ev.on('creds.update', saveCreds)

        const code = await sock.requestPairingCode(number.replace(/[^0-9]/g, ''))
        
        // We can't wait for 'open' here because vercel kills it
        // So we send session later via webhook or just show code
        
        res.status(200).json({
            status: 'success',
            code: code?.match(/.{1,4}/g)?.join('-')
        })
        
        // This part won't reliably run on vercel
        sock.ev.on('connection.update', async (u) => {
            if(u.connection === 'open'){
                // send session to number here
            }
        })

    } catch(e){
        res.status(500).json({ error: e.message })
    }
          } 
