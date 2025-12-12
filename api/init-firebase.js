// api/init-firebase.js
const admin = require('firebase-admin');

// قراءة المفتاح السري من متغير البيئة
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
    throw new Error('FATAL: FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountString);
} catch (e) {
    throw new Error('FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string.');
}

// تهيئة Firebase Admin SDK لمرة واحدة فقط
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// تصدير الأدوات الأساسية
const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };
