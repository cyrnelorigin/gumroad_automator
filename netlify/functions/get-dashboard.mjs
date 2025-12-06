/**
 * Dashboard API - Securely fetches data from Firebase.
 * Uses the SAME Firebase Admin SDK as process-sale.mjs
 */
import admin from 'firebase-admin';

// Initialize Firebase Admin (SAME as process-sale.mjs)
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
  };
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, 'dashboard-app');
}
const db = admin.firestore();

export const handler = async (event) => {
  // SECURITY CHECK
  if (event.queryStringParameters?.key !== process.env.DASHBOARD_SECRET_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    console.log('📊 Dashboard data fetch requested');
    // Fetch last 50 sales
    const salesSnap = await db.collection('sales')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const recentSales = [];
    let totalRevenue = 0;
    let successfulDeliveries = 0;

    salesSnap.forEach(doc => {
      const sale = doc.data();
      recentSales.push({
        id: doc.id,
        orderId: sale.orderId || doc.id,
        customerEmail: sale.customerEmail || 'N/A',
        businessUrl: sale.businessUrl || 'N/A',
        amount: sale.amount || 0,
        currency: sale.currency || 'ZAR',
        auditGenerated: sale.auditGenerated || false,
        emailDelivered: sale.emailDelivered || false,
        timestamp: sale.timestamp?.toDate?.().toLocaleString('en-ZA') || 'N/A'
      });
      if (sale.amount) totalRevenue += sale.amount;
      if (sale.emailDelivered === true) successfulDeliveries++;
    });

    const totalSales = recentSales.length;
    const successRate = totalSales > 0 ? ((successfulDeliveries / totalSales) * 100).toFixed(1) : 0;

    // Return the exact data structure the dashboard expects
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: {
          totalRevenue: totalRevenue.toFixed(2),
          totalSales: totalSales,
          successRate: successRate,
          successfulDeliveries: successfulDeliveries
        },
        recentSales: recentSales
      })
    };

  } catch (error) {
    console.error('❌ Dashboard function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch data', message: error.message })
    };
  }
};
