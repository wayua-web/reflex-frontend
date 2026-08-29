import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// Initial Seed Database
const INITIAL_DB = {
  deliveries: [
    {
      id: 1,
      retailer_id: 1,
      customer_name: 'Wanjiku Mwangi',
      customer_phone: '+254 712 345 678',
      address: 'Kenyatta Avenue, Suite 402, Nairobi',
      item_description: 'Samsung Galaxy A54 5G',
      status: 'assigned',
      assigned_rider_id: 1,
      qr_token: 'REFLEX-DEL-001-XYZ',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      pickup_time: null,
      delivery_time: null,
      status_history: [
        {
          status: 'assigned',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          actor: 'System / Dispatcher',
          note: 'Order placed & assigned to Rider #1'
        }
      ]
    },
    {
      id: 2,
      retailer_id: 1,
      customer_name: 'Brian Otieno',
      customer_phone: '+254 798 765 432',
      address: 'Westlands Commercial Square, 3rd Floor',
      item_description: 'Sony WH-1000XM5 Headphones',
      status: 'picked_up',
      assigned_rider_id: 1,
      qr_token: 'REFLEX-DEL-002-ABC',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      pickup_time: new Date(Date.now() - 1800000).toISOString(),
      delivery_time: null,
      status_history: [
        {
          status: 'assigned',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          actor: 'System / Dispatcher',
          note: 'Order assigned to Rider #1'
        },
        {
          status: 'picked_up',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          actor: 'Rider #1 (John Kamau)',
          note: 'Scan #1 confirmed at shop pickup'
        }
      ]
    },
    {
      id: 3,
      retailer_id: 1,
      customer_name: 'Amina Hassan',
      customer_phone: '+254 722 113 344',
      address: 'Moi Avenue, Digital Plaza Shop 12',
      item_description: 'MacBook Air Charger & Cable',
      status: 'delivered',
      assigned_rider_id: 1,
      qr_token: 'REFLEX-DEL-003-DEF',
      created_at: new Date(Date.now() - 14400000).toISOString(),
      pickup_time: new Date(Date.now() - 10800000).toISOString(),
      delivery_time: new Date(Date.now() - 3600000).toISOString(),
      status_history: [
        {
          status: 'assigned',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          actor: 'System / Dispatcher',
          note: 'Order assigned to Rider #1'
        },
        {
          status: 'picked_up',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          actor: 'Rider #1 (John Kamau)',
          note: 'Scan #1 confirmed at shop pickup'
        },
        {
          status: 'delivered',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          actor: 'Rider #1 (John Kamau)',
          note: 'Scan #2 confirmed at customer handover'
        }
      ]
    }
  ],
  audit_logs: []
};

// Database helper functions
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDB(INITIAL_DB);
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database.json:', err);
    return INITIAL_DB;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database.json:', err);
  }
}

// 1. Health check & Root
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Reflex Delivery Backend API',
    endpoints: [
      'GET /deliveries',
      'POST /deliveries',
      'GET /deliveries/:id',
      'PATCH /deliveries/:id/status',
      'GET /database',
      'POST /database/reset'
    ],
    timestamp: new Date().toISOString()
  });
});

// 2. GET all deliveries
app.get('/deliveries', (req, res) => {
  const db = readDB();
  res.json(db.deliveries);
});

// 3. GET single delivery by ID or QR Token
app.get('/deliveries/:idOrToken', (req, res) => {
  const db = readDB();
  const { idOrToken } = req.params;
  const delivery = db.deliveries.find(
    (d) => String(d.id) === idOrToken || d.qr_token === idOrToken
  );

  if (!delivery) {
    return res.status(404).json({ error: 'Delivery not found' });
  }
  res.json(delivery);
});

// 4. POST /deliveries - Create a new test delivery
app.post('/deliveries', (req, res) => {
  const db = readDB();
  const {
    customer_name,
    customer_phone,
    address,
    item_description,
    retailer_id = 1,
    assigned_rider_id = 1
  } = req.body;

  if (!customer_name || !item_description) {
    return res.status(400).json({ error: 'customer_name and item_description are required' });
  }

  // Generate unique ID & QR token
  const nextId = db.deliveries.length > 0 ? Math.max(...db.deliveries.map((d) => d.id)) + 1 : 1;
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const qrToken = `REFLEX-DEL-${String(nextId).padStart(3, '0')}-${randomSuffix}`;
  const now = new Date().toISOString();

  const newDelivery = {
    id: nextId,
    retailer_id: Number(retailer_id),
    customer_name: customer_name.trim(),
    customer_phone: customer_phone ? customer_phone.trim() : '+254 700 000 000',
    address: address ? address.trim() : 'Nairobi CBD, Kenya',
    item_description: item_description.trim(),
    status: 'assigned',
    assigned_rider_id: Number(assigned_rider_id),
    qr_token: qrToken,
    created_at: now,
    pickup_time: null,
    delivery_time: null,
    status_history: [
      {
        status: 'assigned',
        timestamp: now,
        actor: 'Dispatcher / Test Suite',
        note: `Created delivery #${nextId} with QR Token ${qrToken}`
      }
    ]
  };

  db.deliveries.unshift(newDelivery); // Add to top

  db.audit_logs.push({
    action: 'CREATE_DELIVERY',
    delivery_id: nextId,
    timestamp: now,
    details: `Created new test delivery for ${newDelivery.customer_name}`
  });

  writeDB(db);
  console.log(`[API] Created delivery #${nextId} (${qrToken}) for ${newDelivery.customer_name}`);
  res.status(201).json(newDelivery);
});

// 5. PATCH /deliveries/:id/status - Update delivery status (Scan #1: Pickup, Scan #2: Delivery)
app.patch('/deliveries/:id/status', (req, res) => {
  const db = readDB();
  const deliveryId = Number(req.params.id);
  const { status, changed_by_user_id = 1, note } = req.body;

  const deliveryIndex = db.deliveries.findIndex((d) => d.id === deliveryId);
  if (deliveryIndex === -1) {
    return res.status(404).json({ error: `Delivery #${deliveryId} not found` });
  }

  const delivery = db.deliveries[deliveryIndex];
  const oldStatus = delivery.status;
  const now = new Date().toISOString();

  // Validate status transition
  const validStatuses = ['assigned', 'picked_up', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status "${status}"` });
  }

  // Update status & timestamps
  delivery.status = status;

  let eventNote = note;
  if (status === 'picked_up') {
    delivery.pickup_time = now;
    if (!eventNote) eventNote = 'Scan #1 Confirmed: Item collected from retailer shop';
  } else if (status === 'delivered') {
    delivery.delivery_time = now;
    if (!eventNote) eventNote = 'Scan #2 Confirmed: Item handed to customer';
  }

  // Record in status history
  if (!Array.isArray(delivery.status_history)) {
    delivery.status_history = [];
  }

  delivery.status_history.push({
    status: status,
    previous_status: oldStatus,
    timestamp: now,
    actor: `Rider #${changed_by_user_id} (John Kamau)`,
    note: eventNote
  });

  // Record in system audit logs
  db.audit_logs.push({
    action: 'STATUS_UPDATE',
    delivery_id: deliveryId,
    from_status: oldStatus,
    to_status: status,
    timestamp: now,
    actor_id: changed_by_user_id
  });

  db.deliveries[deliveryIndex] = delivery;
  writeDB(db);

  console.log(`[API] Delivery #${deliveryId} status updated: "${oldStatus}" -> "${status}"`);
  res.json(delivery);
});

// 6. GET /database - Live database dump for Inspector
app.get('/database', (req, res) => {
  const db = readDB();
  res.json({
    database_file: DB_FILE,
    total_deliveries: db.deliveries.length,
    last_updated: new Date().toISOString(),
    data: db
  });
});

// 7. POST /database/reset - Reset database
app.post('/database/reset', (req, res) => {
  writeDB(INITIAL_DB);
  console.log('[API] Database reset to initial state');
  res.json({ message: 'Database reset successfully', deliveries: INITIAL_DB.deliveries });
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 Reflex Delivery API Server Running!`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
  console.log(`=========================================`);
});
