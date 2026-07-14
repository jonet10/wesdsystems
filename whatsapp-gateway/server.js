const express = require('express');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(express.json());

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
    try {
        const artifactPath = 'C:\\Users\\herod\\.gemini\\antigravity\\brain\\22fc4979-e076-424e-a79f-fee58a5bd86d\\qrcode.png';
        await qrcodeImage.toFile(artifactPath, qr, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300
        });
        console.log('\n[WhatsApp] QR Code enregistré avec succès sous : qrcode.png');
    } catch (err) {
        console.error('Erreur lors de l\'enregistrement de l\'image QR Code:', err);
    }
    
    // Garde aussi l'affichage texte par défaut
    console.log('Affichage du QR Code alternatif :');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  PASSERELLE WHATSAPP CONNECTÉE ET PRÊTE !                   ');
    console.log('════════════════════════════════════════════════════════════\n');
});

client.on('auth_failure', msg => {
    console.error('Échec d\'authentification, reconnexion en cours...', msg);
});

// Endpoint d'envoi attendu par la plateforme WesdSystems
app.post('/sendMessage', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Paramètres manquants.' });
    }

    try {
        // Formate le numéro au format requis par WhatsApp (@c.us)
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

client.initialize();

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur de passerelle WhatsApp démarré sur http://localhost:${PORT}`);
});
