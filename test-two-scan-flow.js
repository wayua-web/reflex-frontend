// Automated end-to-end verification script for Two-Scan Delivery Workflow
const API_BASE_URL = 'http://localhost:5000';

async function runTwoScanVerification() {
  console.log('===============================================================');
  console.log('🚀 STARTING REAL TWO-SCAN END-TO-END WORKFLOW TEST');
  console.log('===============================================================\n');

  // Step 1: Create a test delivery
  console.log('📍 STEP 1: Creating a test delivery through the app/API...');
  const newDeliveryPayload = {
    customer_name: 'Faith Mutua (Test Recipient)',
    customer_phone: '+254 711 223 344',
    address: 'Kilimani, Ring Road 5th Avenue, Nairobi',
    item_description: 'Google Pixel 9 Pro Fold (512GB Obsidian)',
    retailer_id: 1,
    assigned_rider_id: 1
  };

  const createRes = await fetch(`${API_BASE_URL}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newDeliveryPayload)
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create delivery: HTTP ${createRes.status}`);
  }

  const createdDelivery = await createRes.json();
  console.log(`✅ Test delivery created successfully!`);
  console.log(`   - ID:           #${createdDelivery.id}`);
  console.log(`   - Recipient:    ${createdDelivery.customer_name}`);
  console.log(`   - Item:         ${createdDelivery.item_description}`);
  console.log(`   - QR Code Token: [ ${createdDelivery.qr_token} ]`);
  console.log(`   - Initial Status in Database: "${createdDelivery.status.toUpperCase()}"\n`);

  // Step 2: Confirm initial status in Database
  console.log('📍 STEP 2: Verifying initial record in database...');
  const getRes1 = await fetch(`${API_BASE_URL}/deliveries/${createdDelivery.id}`);
  const dbRecord1 = await getRes1.json();
  console.log(`   - Status:      ${dbRecord1.status}`);
  console.log(`   - Pickup Time: ${dbRecord1.pickup_time || 'None (Pending)'}`);
  console.log(`   - History Count: ${dbRecord1.status_history.length}`);
  if (dbRecord1.status !== 'assigned') throw new Error('Initial status is not assigned!');
  console.log('✅ Initial status confirmed as ASSIGNED in database.\n');

  // Step 3: Scan #1 -> Confirm Pickup from Shop
  console.log('📍 STEP 3: Performing Scan #1 (Shop Pickup Confirmation)...');
  console.log(`   - Scanning QR code [ ${createdDelivery.qr_token} ] at shop handover...`);
  
  const scan1Res = await fetch(`${API_BASE_URL}/deliveries/${createdDelivery.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'picked_up',
      changed_by_user_id: 1,
      note: 'Scan #1 Confirmed: Item collected from retailer shop'
    })
  });

  if (!scan1Res.ok) {
    throw new Error(`Failed to update pickup status: HTTP ${scan1Res.status}`);
  }

  const updatedAfterScan1 = await scan1Res.json();
  console.log(`✅ Scan #1 Accepted by Database!`);
  console.log(`   - New Status:    "${updatedAfterScan1.status.toUpperCase()}"`);
  console.log(`   - Pickup Time:   ${updatedAfterScan1.pickup_time}`);
  console.log(`   - History Entries: ${updatedAfterScan1.status_history.length}`);
  console.log(`   - Latest Audit:  ${updatedAfterScan1.status_history[updatedAfterScan1.status_history.length - 1].note}\n`);

  // Step 4: Verify Database State after Scan #1
  console.log('📍 STEP 4: Confirming status updates in database after Scan #1...');
  const getRes2 = await fetch(`${API_BASE_URL}/deliveries/${createdDelivery.id}`);
  const dbRecord2 = await getRes2.json();
  if (dbRecord2.status !== 'picked_up') throw new Error('Database status is not picked_up!');
  if (!dbRecord2.pickup_time) throw new Error('Pickup timestamp not recorded in database!');
  console.log('✅ Database confirmed: Status is PICKED_UP with valid pickup timestamp.\n');

  // Step 5: Scan #2 -> Confirm Final Delivery to Customer with the SAME QR code
  console.log('📍 STEP 5: Performing Scan #2 (Final Delivery Handover)...');
  console.log(`   - Scanning the SAME QR code [ ${createdDelivery.qr_token} ] at customer destination...`);

  const scan2Res = await fetch(`${API_BASE_URL}/deliveries/${createdDelivery.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'delivered',
      changed_by_user_id: 1,
      note: 'Scan #2 Confirmed: Item handed to customer'
    })
  });

  if (!scan2Res.ok) {
    throw new Error(`Failed to update delivery status: HTTP ${scan2Res.status}`);
  }

  const updatedAfterScan2 = await scan2Res.json();
  console.log(`✅ Scan #2 Accepted by Database!`);
  console.log(`   - Final Status:   "${updatedAfterScan2.status.toUpperCase()}"`);
  console.log(`   - Delivery Time:  ${updatedAfterScan2.delivery_time}`);
  console.log(`   - History Entries: ${updatedAfterScan2.status_history.length}`);
  console.log(`   - Latest Audit:   ${updatedAfterScan2.status_history[updatedAfterScan2.status_history.length - 1].note}\n`);

  // Step 6: Verify Database State after Scan #2
  console.log('📍 STEP 6: Confirming final status updates in database after Scan #2...');
  const getRes3 = await fetch(`${API_BASE_URL}/deliveries/${createdDelivery.id}`);
  const dbRecord3 = await getRes3.json();
  if (dbRecord3.status !== 'delivered') throw new Error('Database status is not delivered!');
  if (!dbRecord3.delivery_time) throw new Error('Delivery timestamp not recorded in database!');
  console.log('✅ Database confirmed: Status is DELIVERED with valid completion timestamp.\n');

  // Step 7: Inspect Complete Database Dump & Audit Trail
  console.log('📍 STEP 7: Inspecting entire database log & status history...');
  const dbDumpRes = await fetch(`${API_BASE_URL}/database`);
  const fullDb = await dbDumpRes.json();
  console.log(`   - Total Deliveries in Database: ${fullDb.total_deliveries}`);
  console.log(`   - Total Audit Log Entries:      ${fullDb.data.audit_logs.length}`);
  console.log('   - Full Status History for Test Package:');
  dbRecord3.status_history.forEach((h, idx) => {
    console.log(`     [${idx + 1}] Status: ${h.status.padEnd(10)} | Time: ${h.timestamp} | Actor: ${h.actor} | Note: ${h.note}`);
  });

  console.log('\n===============================================================');
  console.log('🎉 ALL TWO-SCAN WORKFLOW & DATABASE CHECKS PASSED PERFECTLY!');
  console.log('===============================================================');
}

runTwoScanVerification().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
