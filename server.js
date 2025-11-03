const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// السماح لجميع المواقع بالوصول إلى هذا الوسيط
app.use(cors());

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype;

        const isImage = fileType.startsWith('image/');
        const apiMethod = isImage ? 'sendPhoto' : 'sendDocument';
        const fileField = isImage ? 'photo' : 'document';

        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append(fileField, fileBuffer, fileName);

        const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${apiMethod}`, {
            method: 'POST',
            body: formData,
        });

        const result = await telegramResponse.json();
        if (!result.ok) {
            throw new Error(result.description || 'Telegram API Error');
        }

        const fileId = isImage ? result.result.photo.pop().file_id : result.result.document.file_id;
        const fileLinkResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileLinkResult = await fileLinkResponse.json();

        if (!fileLinkResult.ok) {
            throw new Error('Failed to get file path from Telegram');
        }

        const finalUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileLinkResult.result.file_path}`;
            
        res.status(200).json({ url: finalUrl, type: fileType.split('/')[0] });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
