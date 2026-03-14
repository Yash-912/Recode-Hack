const assert = require('assert');

async function runApiTest() {
  const PRODUCT_ID = '23f0fec4-e3b9-4918-ad2c-7ca08af75daf'; // The ID from the seed script
  const BASE_URL = 'http://localhost:3000/api';

  try {
    console.log('--- Starting API Integration Test ---');

    // 1. Check Health
    console.log('\n[1] Checking Health...');
    let res = await fetch(`${BASE_URL}/health`);
    let data = await res.json();
    console.log('Health:', data);
    assert.strictEqual(data.status, 'ok', 'Health check failed');

    // 2. Fetch Product
    console.log(`\n[2] Fetching Product ${PRODUCT_ID}...`);
    res = await fetch(`${BASE_URL}/products/${PRODUCT_ID}`);
    data = await res.json();
    console.log(`Product: ${data.name} | Stock: ${data.inventory.remaining}`);
    assert.strictEqual(data.id, PRODUCT_ID, 'Product ID mismatch');

    // 3. Create Guest User
    console.log('\n[3] Creating Guest User...');
    res = await fetch(`${BASE_URL}/auth/guest`, { method: 'POST' });
    data = await res.json();
    const guestToken = data.token;
    const userId = data.userId;
    console.log(`Created Guest! User ID: ${userId} | Token: ${guestToken.substring(0, 15)}...`);
    assert(guestToken, 'Missing guest token');

    // 4. Get Checkout Token
    console.log('\n[4] Requesting Checkout Token...');
    res = await fetch(`${BASE_URL}/products/${PRODUCT_ID}/checkout-token`);
    data = await res.json();
    const checkoutToken = data.token;
    console.log(`Checkout Token: ${checkoutToken}`);
    assert(checkoutToken, 'Missing checkout token');

    // 5. Submit Checkout
    console.log('\n[5] Submitting Checkout...');
    const idempotencyKey = crypto.randomUUID();
    
    res = await fetch(`${BASE_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
        'Idempotency-Key': idempotencyKey,
        'X-Checkout-Token': checkoutToken
      },
      body: JSON.stringify({
        productId: PRODUCT_ID,
        quantity: 1
      })
    });
    
    data = await res.json();
    console.log(`Checkout Response (Status ${res.status}):`, data);
    
    if (res.status === 202) {
      console.log('✅ Checkout successfully queued!');
      
      const jobId = data.jobId;
      
      // 6. Poll Queue Status
      console.log(`\n[6] Polling Queue Status for Job ${jobId}...`);
      await new Promise(resolve => setTimeout(resolve, 500)); // wait a bit for worker
      
      res = await fetch(`${BASE_URL}/queue-status/${jobId}`);
      data = await res.json();
      console.log('Queue Status Response:', data);

      if (data.status === 'completed' || data.success) {
         console.log('✅ Worker processed job successfully!');
      } else {
         console.log('⚠️ Worker result pending or sold out:', data);
      }
    } else {
      console.log('❌ Checkout failed:', data);
    }

    console.log('\n--- API Integration Test Completed ---');

  } catch (err) {
    console.error('Test Failed:', err);
  }
}

runApiTest();
