const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

let connectionState = 'INITIALIZING'; // 'INITIALIZING' | 'DISCONNECTED' | 'CONNECTED'
let qrDataUrl = null;

// Initialisation du client WhatsApp avec sauvegarde de session locale
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Événement d'affichage du QR code pour connecter le téléphone
client.on('qr', async (qr) => {
    connectionState = 'DISCONNECTED';
    try {
        qrDataUrl = await qrcodeImage.toDataURL(qr);
        const artifactPath = 'C:\\Users\\herod\\.gemini\\antigravity\\brain\\22fc4979-e076-424e-a79f-fee58a5bd86d\\qrcode.png';
        await qrcodeImage.toFile(artifactPath, qr, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300
        });
        console.log('\n[WhatsApp] QR Code mis à jour et enregistré sous qrcode.png');
    } catch (err) {
        console.error('Erreur lors de la génération du QR Code image:', err);
    }
    
    // Garde aussi l'affichage texte par défaut
    console.log('Affichage du QR Code alternatif :');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    connectionState = 'CONNECTED';
    qrDataUrl = null;
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  PASSERELLE WHATSAPP CONNECTÉE ET PRÊTE !                   ');
    console.log('════════════════════════════════════════════════════════════\n');
});

client.on('disconnected', () => {
    connectionState = 'DISCONNECTED';
    qrDataUrl = null;
    console.log('\n[WhatsApp] Déconnecté de WhatsApp.');
});

client.on('auth_failure', msg => {
    connectionState = 'DISCONNECTED';
    qrDataUrl = null;
    console.error('Échec d\'authentification WhatsApp:', msg);
});

// Endpoint d'envoi attendu par la plateforme WesdSystems
app.post('/sendMessage', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Paramètres manquants.' });
    }

    try {
        const cleanPhone = phone.replace(/\D/g, "");
        const chatId = `${cleanPhone}@c.us`;
        
        await client.sendMessage(chatId, message);
        console.log(`[WhatsApp] Message envoyé avec succès à : ${cleanPhone}`);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[WhatsApp] Erreur lors de l\'envoi:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Exposer l'état et le QR Code pour le tableau de bord admin
app.get('/status', (req, res) => {
    res.json({
        state: connectionState,
        qr: qrDataUrl
    });
});

// Exposer la demande de code d'association depuis le dashboard
app.post('/request-pairing-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Téléphone requis.' });
    }
    try {
        const cleanPhone = phone.replace(/\D/g, "");
        console.log(`[WhatsApp] Demande de code d'association demandée par l'API pour : ${cleanPhone}`);
        const code = await client.requestPairingCode(cleanPhone);
        res.json({ code });
    } catch (err) {
        console.error('[WhatsApp] Erreur lors de la demande de code d\'association:', err);
        res.status(500).json({ error: err.message });
    }
});

client.initialize();

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur de passerelle WhatsApp démarré sur http://localhost:${PORT}`);
});
