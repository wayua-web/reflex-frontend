import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';

const CURRENT_RIDER_ID = 1; // John Kamau (Test Rider)

// Automatically detect host (localhost or local network IP like 192.168.0.103)
const getApiBaseUrl = () => {
  return 'https://reflex-backend-ot79.onrender.com';
};

// Preset templates for fast 1-click test delivery creation
const TEST_DELIVERY_PRESETS = [
  {
    customer_name: 'David Mwangi',
    customer_phone: '+254 712 987 654',
    address: 'Kenyatta Ave, Jubilee Exchange Suite 501, Nairobi',
    item_description: 'Apple iPhone 16 Pro Max 256GB'
  },
  {
    customer_name: 'Grace Njeri',
    customer_phone: '+254 733 456 789',
    address: 'Westlands Square, Ring Road Parklands, 4th Floor',
    item_description: 'Sony WH-1000XM5 Noise-Canceling Headphones'
  },
  {
    customer_name: 'Hassan Omar',
    customer_phone: '+254 722 889 900',
    address: 'Moi Avenue, Digital Plaza Shop #14, Nairobi CBD',
    item_description: 'MacBook Pro M3 Charger & USB-C Cable'
  },
  {
    customer_name: 'Faith Chebet',
    customer_phone: '+254 705 112 233',
    address: 'Upper Hill Medical Center, 2nd Floor Pharmacy',
    item_description: 'Urgent Medical Supplies & Prescription Box'
  }
];

export default function RiderView() {
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBaseUrl());
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Modals & UI States
  const [activeScanDelivery, setActiveScanDelivery] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Create Delivery Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    item_description: '',
    assigned_rider_id: 1
  });
  const [creatingDelivery, setCreatingDelivery] = useState(false);

  // QR Code Display Modal State
  const [selectedQrDelivery, setSelectedQrDelivery] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [fullscreenQr, setFullscreenQr] = useState(false);

  // Database Inspector Drawer State
  const [dbInspectorOpen, setDbInspectorOpen] = useState(false);
  const [dbRawData, setDbRawData] = useState(null);
  const [loadingDb, setLoadingDb] = useState(false);

  // Phone Pair / Wi-Fi Modal State
  const [phonePairModalOpen, setPhonePairModalOpen] = useState(false);
  const [phoneUrlQr, setPhoneUrlQr] = useState('');
  const [localIpAddress, setLocalIpAddress] = useState('192.168.0.103');

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scannerRef = useRef(null);

  // Sound feedback for successful scan
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch (e) {
      console.warn('AudioContext not allowed or supported', e);
    }
  };

  // 1. Fetch Deliveries from Backend
  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${apiBaseUrl}/deliveries`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
      const data = await res.json();
      setDeliveries(Array.isArray(data) ? data : []);
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Backend unavailable:', err.message);
      setError(`Cannot connect to Backend API at ${apiBaseUrl}`);
      // Fallback to local storage or demo mode
      const saved = localStorage.getItem('reflex_local_deliveries');
      if (saved) {
        setDeliveries(JSON.parse(saved));
        setIsDemoMode(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [apiBaseUrl]);
  useEffect(() => {
  const socket = io(apiBaseUrl);

  socket.on('statusUpdated', () => {
    fetchDeliveries();
  });

  return () => {
    socket.disconnect();
  };
}, [apiBaseUrl]);

  // Generate QR Code for Phone Wi-Fi Connect
  useEffect(() => {
    const hostname = window.location.hostname || '192.168.0.103';
    const port = window.location.port || '5173';
    const mobileUrl = `http://${hostname}:${port}`;
    setLocalIpAddress(hostname);
    QRCode.toDataURL(mobileUrl, { width: 260, margin: 2 })
      .then((url) => setPhoneUrlQr(url))
      .catch((e) => console.error(e));
  }, []);

  // Generate QR Code whenever selectedQrDelivery changes
  useEffect(() => {
    if (selectedQrDelivery?.qr_token) {
      QRCode.toDataURL(selectedQrDelivery.qr_token, {
        width: 320,
        margin: 2,
        color: { dark: '#0a0a0a', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    } else {
      setQrDataUrl('');
    }
  }, [selectedQrDelivery]);

  // 2. Fetch Full Database for Inspector
  const fetchDatabaseState = async () => {
    try {
      setLoadingDb(true);
      const res = await fetch(`${apiBaseUrl}/database`);
      if (res.ok) {
        const data = await res.json();
        setDbRawData(data);
      } else {
        setDbRawData({ deliveries, note: 'Local state (Backend returned ' + res.status + ')' });
      }
    } catch (e) {
      setDbRawData({ deliveries, note: 'Local state (Offline fallback)' });
    } finally {
      setLoadingDb(false);
    }
  };

  const openDbInspector = () => {
    setDbInspectorOpen(true);
    fetchDatabaseState();
  };

  // 3. Reset Database
  const resetDatabase = async () => {
    if (!window.confirm('Are you sure you want to reset the database to initial seed deliveries?')) return;
    try {
      setUpdating(true);
      const res = await fetch(`${apiBaseUrl}/database/reset`, { method: 'POST' });
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: '🔄 Database successfully reset to initial test state!'
        });
        await fetchDeliveries();
        if (dbInspectorOpen) fetchDatabaseState();
      }
    } catch (e) {
      setActionFeedback({ type: 'error', message: 'Failed to reset database: ' + e.message });
    } finally {
      setUpdating(false);
    }
  };

  // 4. Create New Test Delivery
  const handleCreateDelivery = async (e) => {
    if (e) e.preventDefault();
    if (!formData.customer_name || !formData.item_description) {
      alert('Please enter recipient name and item description.');
      return;
    }

    try {
      setCreatingDelivery(true);
      const payload = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || '+254 700 000 000',
        address: formData.address || 'Nairobi CBD, Kenya',
        item_description: formData.item_description,
        assigned_rider_id: Number(formData.assigned_rider_id) || CURRENT_RIDER_ID,
        retailer_id: 1
      };

      if (!isDemoMode && !error) {
        const res = await fetch(`${apiBaseUrl}/deliveries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = await res.json();
        setCreateModalOpen(false);
        setActionFeedback({
          type: 'success',
          message: `🎉 Test Delivery #${created.id} created! QR Token: ${created.qr_token}`
        });
        await fetchDeliveries();
        // Immediately pop open the QR preview for easy scanning!
        setSelectedQrDelivery(created);
      } else {
        // Local mode fallback
        const nextId = deliveries.length > 0 ? Math.max(...deliveries.map((d) => d.id)) + 1 : 1;
        const qrToken = `REFLEX-DEL-${String(nextId).padStart(3, '0')}-${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;
        const newD = {
          id: nextId,
          ...payload,
          status: 'assigned',
          qr_token: qrToken,
          created_at: new Date().toISOString(),
          pickup_time: null,
          delivery_time: null,
          status_history: [
            {
              status: 'assigned',
              timestamp: new Date().toISOString(),
              actor: 'Dispatcher / Tester',
              note: `Created delivery #${nextId} with QR ${qrToken}`
            }
          ]
        };
        const updatedList = [newD, ...deliveries];
        setDeliveries(updatedList);
        localStorage.setItem('reflex_local_deliveries', JSON.stringify(updatedList));
        setCreateModalOpen(false);
        setActionFeedback({
          type: 'success',
          message: `🎉 Test Delivery #${newD.id} created! QR Token: ${newD.qr_token}`
        });
        setSelectedQrDelivery(newD);
      }

      // Reset form data
      setFormData({
        customer_name: '',
        customer_phone: '',
        address: '',
        item_description: '',
        assigned_rider_id: 1
      });
    } catch (err) {
      console.error('Failed to create delivery:', err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to create test delivery: ' + err.message
      });
    } finally {
      setCreatingDelivery(false);
    }
  };

  const applyPreset = (preset) => {
    setFormData({
      customer_name: preset.customer_name,
      customer_phone: preset.customer_phone,
      address: preset.address,
      item_description: preset.item_description,
      assigned_rider_id: 1
    });
  };

  // 5. Helper to determine the Two-Scan Step Information
  const getScanFlowInfo = (delivery) => {
    const s = (delivery?.status || '').toLowerCase();

    if (s === 'assigned' || s === 'pending') {
      return {
        scanNumber: 1,
        scanTitle: 'Scan #1: Confirm Pickup from Shop',
        stepBadge: 'STEP 1 OF 2: PICKUP',
        stepDescription: 'Confirms physical pickup and possession of package at the shop.',
        currentStatusDisplay: 'ASSIGNED',
        nextStatus: 'picked_up',
        actionLabel: 'Confirm Pickup',
        badgeColor: '#eab308', // Amber
        actionColor: '#2563eb', // Blue
        isCompleted: false
      };
    }

    if (s === 'picked_up') {
      return {
        scanNumber: 2,
        scanTitle: 'Scan #2: Confirm Final Delivery to Customer',
        stepBadge: 'STEP 2 OF 2: DELIVERY',
        stepDescription: 'Confirms successful package handover to the customer at destination.',
        currentStatusDisplay: 'PICKED UP',
        nextStatus: 'delivered',
        actionLabel: 'Confirm Delivery',
        badgeColor: '#3b82f6', // Blue
        actionColor: '#16a34a', // Green
        isCompleted: false
      };
    }

    if (s === 'delivered') {
      return {
        scanNumber: null,
        scanTitle: 'Delivery Completed',
        stepBadge: 'COMPLETED',
        stepDescription: 'This package was delivered and closed in the database.',
        currentStatusDisplay: 'DELIVERED',
        nextStatus: null,
        actionLabel: 'Already Delivered',
        badgeColor: '#22c55e', // Green
        actionColor: '#6b7280',
        isCompleted: true
      };
    }

    return {
      scanNumber: 1,
      scanTitle: 'Update Status',
      stepBadge: 'UPDATE',
      stepDescription: `Current status is ${delivery.status}`,
      currentStatusDisplay: delivery.status?.toUpperCase() || 'UNKNOWN',
      nextStatus: 'picked_up',
      actionLabel: 'Update Status',
      badgeColor: '#6b7280',
      actionColor: '#4f46e5',
      isCompleted: false
    };
  };

  // 6. QR Code Scan Success Handler
  const handleScanSuccess = (decodedText) => {
    const scanned = decodedText.trim();
    console.log('Decoded QR code:', scanned);
    playScanBeep();

    // Match delivery by token or ID
    const matched = deliveries.find(
      (d) => d.qr_token === scanned || String(d.id) === scanned || scanned.includes(d.qr_token)
    );

    if (!matched) {
      setActionFeedback({
        type: 'error',
        message: `❌ Scanned QR code "${scanned}" does not match any delivery in database.`
      });
      return;
    }

    const scanInfo = getScanFlowInfo(matched);

    if (scanInfo.isCompleted) {
      setActionFeedback({
        type: 'info',
        message: `ℹ️ Delivery #${matched.id} (${matched.item_description}) is ALREADY DELIVERED & completed!`
      });
      closeScanner();
      return;
    }

    closeScanner();
    setActiveScanDelivery({
      delivery: matched,
      ...scanInfo
    });
  };

  // 7. Initialize Html5QrcodeScanner
  useEffect(() => {
    if (scannerOpen) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true
        },
        false
      );

      scanner.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Frame noise, ignore
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch((err) => console.error('Clear scanner err:', err));
        }
      };
    }
  }, [scannerOpen, deliveries]);

  const openScanner = (forDelivery = null) => {
    if (forDelivery) {
      const info = getScanFlowInfo(forDelivery);
      if (info.isCompleted) {
        setActionFeedback({
          type: 'info',
          message: `Delivery #${forDelivery.id} is already completed.`
        });
        return;
      }
      setActiveScanDelivery({ delivery: forDelivery, ...info });
    } else {
      setActiveScanDelivery(null);
    }
    setScannerOpen(true);
    setActionFeedback(null);
  };

  const closeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch((err) => console.error(err));
      scannerRef.current = null;
    }
    setScannerOpen(false);
  };

  // 8. Update Delivery Status (Scan #1 / Scan #2)
  const updateDeliveryStatus = async (deliveryId, nextStatus, scanNumber) => {
    try {
      setUpdating(true);
      setActionFeedback(null);

      const noteText =
        scanNumber === 1
          ? 'Scan #1 Confirmed: Item collected from retailer shop'
          : scanNumber === 2
          ? 'Scan #2 Confirmed: Item delivered to customer'
          : `Status changed to ${nextStatus}`;

      if (!isDemoMode && !error) {
        const response = await fetch(`${apiBaseUrl}/deliveries/${deliveryId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            changed_by_user_id: CURRENT_RIDER_ID,
            note: noteText
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const updated = await response.json();
        console.log('Database updated successfully:', updated);

        setActionFeedback({
          type: 'success',
          message: `✅ [Scan #${scanNumber} Confirmed] Delivery #${deliveryId} status updated in database to "${nextStatus.toUpperCase()}"!`
        });

        await fetchDeliveries();
        if (dbInspectorOpen) fetchDatabaseState();
      } else {
        // Local state update
        const now = new Date().toISOString();
        const updatedList = deliveries.map((d) => {
          if (d.id === deliveryId) {
            const hist = Array.isArray(d.status_history) ? [...d.status_history] : [];
            hist.push({
              status: nextStatus,
              previous_status: d.status,
              timestamp: now,
              actor: `Rider #${CURRENT_RIDER_ID} (John Kamau)`,
              note: noteText
            });
            return {
              ...d,
              status: nextStatus,
              pickup_time: nextStatus === 'picked_up' ? now : d.pickup_time,
              delivery_time: nextStatus === 'delivered' ? now : d.delivery_time,
              status_history: hist
            };
          }
          return d;
        });

        setDeliveries(updatedList);
        localStorage.setItem('reflex_local_deliveries', JSON.stringify(updatedList));

        setActionFeedback({
          type: 'success',
          message: `✅ [Scan #${scanNumber} Confirmed] Delivery #${deliveryId} status updated to "${nextStatus.toUpperCase()}"!`
        });
      }

      setActiveScanDelivery(null);
    } catch (err) {
      console.error('Error updating status:', err);
      setActionFeedback({
        type: 'error',
        message: `Failed to update status in database: ${err.message}`
      });
    } finally {
      setUpdating(false);
    }
  };

  // Filter deliveries
  const filteredDeliveries = deliveries.filter((d) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? d.status === 'assigned' || d.status === 'picked_up'
        : d.status === statusFilter;

    const matchesSearch =
      !searchQuery ||
      d.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.item_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.qr_token?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(d.id).includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  return (
    <div style={styles.appContainer}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          <div style={styles.logoBadge}>🏍️</div>
          <div>
            <h1 style={styles.navTitle}>Reflex Courier</h1>
            <p style={styles.navSubtitle}>Rider Portal & Two-Scan Verification Engine</p>
          </div>
        </div>

        <div style={styles.navRight}>
          <div style={styles.connectionStatus(error ? '#ef4444' : '#10b981')}>
            <span style={styles.statusDot(error ? '#ef4444' : '#10b981')} />
            {error ? 'Offline / Local Mode' : 'Live Database Connected'}
          </div>

          <button onClick={() => setPhonePairModalOpen(true)} style={styles.phonePairBtn}>
            📱 Phone Connect
          </button>

          <button onClick={openDbInspector} style={styles.dbInspectBtn}>
            🗄️ Database Inspector
          </button>

          <button onClick={() => setCreateModalOpen(true)} style={styles.createBtn}>
            ➕ Create Test Delivery
          </button>
        </div>
      </header>

      {/* Hero / Two-Scan Process Banner */}
      <div style={styles.twoScanBanner}>
        <div style={styles.twoScanHeader}>
          <h2 style={styles.twoScanTitle}>🔄 Two-Scan Delivery Workflow</h2>
          <span style={styles.twoScanSub}>Standard Operating Procedure (SOP)</span>
        </div>

        <div style={styles.stepCardsGrid}>
          {/* Step 1 */}
          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge(1)}>SCAN 1</div>
            <div style={styles.stepCardContent}>
              <h3 style={styles.stepHeading}>📦 Confirm Shop Pickup</h3>
              <p style={styles.stepText}>
                Rider collects parcel from shop &rarr; Scans QR code &rarr; Database status updates from{' '}
                <code>assigned</code> to <code>picked_up</code>.
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div style={styles.stepArrow}>➔</div>

          {/* Step 2 */}
          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge(2)}>SCAN 2</div>
            <div style={styles.stepCardContent}>
              <h3 style={styles.stepHeading}>🏁 Confirm Final Delivery</h3>
              <p style={styles.stepText}>
                Rider reaches customer &rarr; Scans <strong>the SAME QR code</strong> &rarr; Database status updates from{' '}
                <code>picked_up</code> to <code>delivered</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Real camera testing instructions */}
        <div style={styles.testingTipRow}>
          <span>💡 <strong>Real Device Test Tip:</strong> Open this app on your laptop and your phone. Click <strong>"View QR"</strong> on your laptop, and scan it using your phone's camera (or click <strong>"Phone Connect"</strong> to open on mobile).</span>
        </div>
      </div>

      {/* Global Alerts / Feedback */}
      {actionFeedback && (
        <div
          style={{
            ...styles.alertBanner,
            backgroundColor:
              actionFeedback.type === 'success'
                ? '#ecfdf5'
                : actionFeedback.type === 'info'
                ? '#eff6ff'
                : '#fef2f2',
            borderColor:
              actionFeedback.type === 'success'
                ? '#10b981'
                : actionFeedback.type === 'info'
                ? '#3b82f6'
                : '#ef4444',
            color:
              actionFeedback.type === 'success'
                ? '#065f46'
                : actionFeedback.type === 'info'
                ? '#1e40af'
                : '#991b1b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {actionFeedback.type === 'success' ? '✅' : actionFeedback.type === 'info' ? 'ℹ️' : '⚠️'}
            </span>
            <span style={{ fontWeight: '500' }}>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} style={styles.closeAlertBtn}>
            ✕
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <button
            onClick={() => setStatusFilter('all')}
            style={styles.filterTab(statusFilter === 'all')}
          >
            All Packages ({deliveries.length})
          </button>
          <button
            onClick={() => setStatusFilter('assigned')}
            style={styles.filterTab(statusFilter === 'assigned')}
          >
            Ready for Pickup ({deliveries.filter((d) => d.status === 'assigned').length})
          </button>
          <button
            onClick={() => setStatusFilter('picked_up')}
            style={styles.filterTab(statusFilter === 'picked_up')}
          >
            In Transit ({deliveries.filter((d) => d.status === 'picked_up').length})
          </button>
          <button
            onClick={() => setStatusFilter('delivered')}
            style={styles.filterTab(statusFilter === 'delivered')}
          >
            Completed ({deliveries.filter((d) => d.status === 'delivered').length})
          </button>
        </div>

        <div style={styles.searchAndScanBox}>
          <input
            type="text"
            placeholder="🔍 Search package, customer, QR token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <button onClick={() => openScanner()} style={styles.openScannerMainBtn}>
            📷 Open QR Scanner
          </button>
          <button onClick={fetchDeliveries} style={styles.refreshBtn} title="Refresh Deliveries">
            🔄
          </button>
        </div>
      </div>

      {/* Delivery Cards Grid */}
      <main style={styles.mainGrid}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p>Loading assigned deliveries from database...</p>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No packages match your search</h3>
            <p>Click "Create Test Delivery" to add a new test package to the system.</p>
            <button onClick={() => setCreateModalOpen(true)} style={styles.createBtnLarge}>
              ➕ Create Test Delivery Now
            </button>
          </div>
        ) : (
          filteredDeliveries.map((delivery) => {
            const scanInfo = getScanFlowInfo(delivery);

            return (
              <div key={delivery.id} style={styles.deliveryCard}>
                {/* Top Card Bar */}
                <div style={styles.cardTopBar}>
                  <div>
                    <span style={styles.cardDeliveryId}>#{delivery.id}</span>
                    <span style={styles.cardQrToken}>{delivery.qr_token}</span>
                  </div>
                  <span style={styles.statusBadge(scanInfo.badgeColor)}>
                    {scanInfo.currentStatusDisplay}
                  </span>
                </div>

                {/* Step Indicator Banner on Card */}
                <div style={styles.cardStepBanner(scanInfo.badgeColor)}>
                  <span>{scanInfo.stepBadge}</span>
                </div>

                {/* Card Body */}
                <div style={styles.cardBody}>
                  <div style={styles.cardItemTitle}>{delivery.item_description}</div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Recipient:</span>
                    <span style={styles.detailValBold}>{delivery.customer_name}</span>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Phone:</span>
                    <a href={`tel:${delivery.customer_phone}`} style={styles.phoneLink}>
                      📞 {delivery.customer_phone}
                    </a>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Destination:</span>
                    <span style={styles.detailVal}>📍 {delivery.address}</span>
                  </div>

                  {/* Timestamps */}
                  <div style={styles.timestampBox}>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Created:</span>
                      <span style={styles.timeVal}>
                        {new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Pickup:</span>
                      <span style={styles.timeVal}>
                        {delivery.pickup_time
                          ? new Date(delivery.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Delivered:</span>
                      <span style={styles.timeVal}>
                        {delivery.delivery_time
                          ? new Date(delivery.delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={styles.cardActions}>
                  <button
                    onClick={() => setSelectedQrDelivery(delivery)}
                    style={styles.viewQrButton}
                  >
                    👁️ View / Print QR Code
                  </button>

                  {!scanInfo.isCompleted ? (
                    <div style={styles.actionButtonGroup}>
                      <button
                        onClick={() => openScanner(delivery)}
                        style={{
                          ...styles.primaryActionBtn,
                          backgroundColor: scanInfo.actionColor
                        }}
                      >
                        📷 {scanInfo.scanTitle}
                      </button>

                      <button
                        onClick={() => {
                          setActiveScanDelivery({
                            delivery,
                            ...scanInfo
                          });
                        }}
                        style={styles.simulateScanBtn}
                        title="Simulate scan without opening camera"
                      >
                        ⚡ Direct {scanInfo.actionLabel}
                      </button>
                    </div>
                  ) : (
                    <div style={styles.completedBadgeBox}>
                      ✅ Order Delivered & Closed in Database
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* ========================================================================= */}
      {/* 1. CREATE TEST DELIVERY MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>➕</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>
                    Create Test Delivery
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                    Generate a fresh test package to verify the Two-Scan sequence
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div style={styles.presetsContainer}>
              <span style={styles.presetTitle}>⚡ 1-Click Fast Presets:</span>
              <div style={styles.presetButtonsGrid}>
                {TEST_DELIVERY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={styles.presetButton}
                  >
                    📦 {preset.item_description.split(' ')[0]} ({preset.customer_name.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateDelivery} style={styles.formContainer}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Item Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samsung Galaxy S24 Ultra"
                  value={formData.item_description}
                  onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Recipient Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kevin Ochieng"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Recipient Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. +254 711 223 344"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    style={styles.formInput}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Delivery Address</label>
                <input
                  type="text"
                  placeholder="e.g. Kimathi Street, Eagle House 4th Floor, Nairobi"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={styles.formInput}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={styles.modalSecondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDelivery}
                  style={styles.modalPrimaryBtn}
                >
                  {creatingDelivery ? 'Creating...' : '🚀 Create Delivery & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QR CODE DISPLAY / PRINT MODAL */}
      {/* ========================================================================= */}
      {selectedQrDelivery && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '440px', textAlign: 'center' }}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  QR Code for Package #{selectedQrDelivery.id}
                </h3>
                <span style={styles.statusBadge(getScanFlowInfo(selectedQrDelivery).badgeColor)}>
                  STATUS: {selectedQrDelivery.status?.toUpperCase()}
                </span>
              </div>
              <button onClick={() => setSelectedQrDelivery(null)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <div style={styles.qrDisplayBody}>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#4b5563' }}>
                <strong>{selectedQrDelivery.item_description}</strong>
                <br />
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  For {selectedQrDelivery.customer_name} ({selectedQrDelivery.address})
                </span>
              </p>

              {/* QR Image Container */}
              <div style={styles.qrCanvasContainer}>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${selectedQrDelivery.qr_token}`}
                    style={styles.qrImage}
                  />
                ) : (
                  <div style={{ padding: '60px', color: '#9ca3af' }}>Generating QR...</div>
                )}
              </div>

              {/* QR Token text with copy */}
              <div style={styles.qrTokenBox}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>SCANNABLE TOKEN:</span>
                <code style={styles.qrTokenText}>{selectedQrDelivery.qr_token}</code>
              </div>

              {/* Instructions */}
              <div style={styles.qrInstructionCallout}>
                <span style={{ fontWeight: '600', color: '#1e40af' }}>📱 How to test scanning:</span>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#1e3a8a' }}>
                  Point your <strong>phone's camera</strong> or <strong>another device's camera</strong> at this QR code on the screen!
                </p>
              </div>

              {/* Action Buttons */}
              <div style={styles.qrModalBtnGrid}>
                <button
                  onClick={() => {
                    const token = selectedQrDelivery.qr_token;
                    setSelectedQrDelivery(null);
                    handleScanSuccess(token);
                  }}
                  style={styles.simulateDirectBtn}
                >
                  ⚡ Simulate Scan of this QR
                </button>

                <button
                  onClick={() => {
                    window.print();
                  }}
                  style={styles.printLabelBtn}
                >
                  🖨️ Print Label Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CAMERA QR SCANNER MODAL */}
      {/* ========================================================================= */}
      {scannerOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '480px' }}>
            <div style={styles.scannerHeaderRow}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>
                  📷 Live QR Code Scanner
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                  Point your camera at the package QR code (on paper or another screen)
                </p>
              </div>
              <button onClick={closeScanner} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            {/* HTML5 QR Code Mount Element */}
            <div id="qr-reader" style={styles.qrScannerMount} />

            <div style={styles.scannerFooter}>
              <button onClick={closeScanner} style={styles.cancelScannerBtn}>
                Cancel Scanning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CONFIRMATION MODAL (SCAN #1: PICKUP vs SCAN #2: DELIVERY) */}
      {/* ========================================================================= */}
      {activeScanDelivery && !scannerOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '480px' }}>
            {/* Header with step color */}
            <div style={styles.scanConfirmHeader(activeScanDelivery.actionColor)}>
              <span style={styles.scanStepPill}>{activeScanDelivery.stepBadge}</span>
              <h2 style={{ margin: '8px 0 4px', fontSize: '1.3rem', color: '#ffffff' }}>
                {activeScanDelivery.scanTitle}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.95, color: '#ffffff' }}>
                {activeScanDelivery.stepDescription}
              </p>
            </div>

            {/* Delivery Details Card */}
            <div style={styles.confirmModalDetails}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Delivery ID:</span>
                <span style={styles.detailValBold}>#{activeScanDelivery.delivery.id}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>QR Token:</span>
                <code style={{ fontSize: '0.85rem' }}>{activeScanDelivery.delivery.qr_token}</code>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Package Item:</span>
                <span style={styles.detailValBold}>{activeScanDelivery.delivery.item_description}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Customer:</span>
                <span style={styles.detailVal}>{activeScanDelivery.delivery.customer_name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Address:</span>
                <span style={styles.detailVal}>📍 {activeScanDelivery.delivery.address}</span>
              </div>

              {/* State Transition Visual Box */}
              <div style={styles.stateTransitionCard}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>
                  DATABASE STATUS UPDATE:
                </span>
                <div style={styles.stateTransitionFlow}>
                  <span style={styles.statusPill(activeScanDelivery.badgeColor)}>
                    {activeScanDelivery.currentStatusDisplay}
                  </span>
                  <span style={{ fontSize: '1.2rem', color: activeScanDelivery.actionColor }}>➔</span>
                  <span style={styles.statusPill(activeScanDelivery.actionColor)}>
                    {activeScanDelivery.nextStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.modalFooter}>
              <button
                onClick={() => setActiveScanDelivery(null)}
                style={styles.modalSecondaryBtn}
                disabled={updating}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  updateDeliveryStatus(
                    activeScanDelivery.delivery.id,
                    activeScanDelivery.nextStatus,
                    activeScanDelivery.scanNumber
                  )
                }
                style={{
                  ...styles.modalPrimaryBtn,
                  backgroundColor: activeScanDelivery.actionColor
                }}
                disabled={updating}
              >
                {updating ? 'Updating Database...' : `✅ Confirm & Update to "${activeScanDelivery.nextStatus.toUpperCase()}"`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DATABASE INSPECTOR DRAWER / MODAL */}
      {/* ========================================================================= */}
      {dbInspectorOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '850px', maxHeight: '90vh' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🗄️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Live Database Inspector</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                    Inspect real-time records in <code>database.json</code> & audit trail
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={fetchDatabaseState} style={styles.refreshBtn}>
                  🔄 Refresh
                </button>
                <button onClick={resetDatabase} style={styles.resetDbBtn}>
                  ⚠️ Reset DB
                </button>
                <button onClick={() => setDbInspectorOpen(false)} style={styles.modalCloseBtn}>
                  ✕
                </button>
              </div>
            </div>

            <div style={styles.dbInspectorBody}>
              {loadingDb ? (
                <p style={{ textAlign: 'center', padding: '40px' }}>Loading database contents...</p>
              ) : (
                <>
                  {/* Database Summary Stats */}
                  <div style={styles.dbStatsGrid}>
                    <div style={styles.dbStatCard}>
                      <span style={styles.dbStatNum}>{deliveries.length}</span>
                      <span style={styles.dbStatLabel}>Total Deliveries</span>
                    </div>
                    <div style={styles.dbStatCard}>
                      <span style={styles.dbStatNum}>
                        {deliveries.filter((d) => d.status === 'assigned').length}
                      </span>
                      <span style={styles.dbStatLabel}>Assigned (Pre-Scan 1)</span>
                    </div>
                    <div style={styles.dbStatCard}>
                      <span style={styles.dbStatNum}>
                        {deliveries.filter((d) => d.status === 'picked_up').length}
                      </span>
                      <span style={styles.dbStatLabel}>Picked Up (Post-Scan 1)</span>
                    </div>
                    <div style={styles.dbStatCard}>
                      <span style={styles.dbStatNum}>
                        {deliveries.filter((d) => d.status === 'delivered').length}
                      </span>
                      <span style={styles.dbStatLabel}>Delivered (Post-Scan 2)</span>
                    </div>
                  </div>

                  {/* Database Records Table */}
                  <h4 style={{ margin: '16px 0 8px', color: '#374151' }}>📋 Delivery Records & State History</h4>
                  <div style={styles.dbTableContainer}>
                    <table style={styles.dbTable}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>QR Token</th>
                          <th>Recipient</th>
                          <th>Status</th>
                          <th>Scan 1 (Pickup)</th>
                          <th>Scan 2 (Delivery)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((d) => (
                          <tr key={d.id}>
                            <td><strong>#{d.id}</strong></td>
                            <td><code>{d.qr_token}</code></td>
                            <td>{d.customer_name}</td>
                            <td>
                              <span
                                style={styles.statusBadge(
                                  d.status === 'delivered'
                                    ? '#22c55e'
                                    : d.status === 'picked_up'
                                    ? '#3b82f6'
                                    : '#eab308'
                                )}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td>
                              {d.pickup_time ? (
                                <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>
                                  ✅ {new Date(d.pickup_time).toLocaleTimeString()}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>Pending</span>
                              )}
                            </td>
                            <td>
                              {d.delivery_time ? (
                                <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>
                                  ✅ {new Date(d.delivery_time).toLocaleTimeString()}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Raw JSON View */}
                  <h4 style={{ margin: '16px 0 8px', color: '#374151' }}>📜 Raw Database JSON</h4>
                  <pre style={styles.rawJsonBox}>
                    {JSON.stringify(dbRawData || deliveries, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PHONE CONNECT / WI-FI PAIRING MODAL */}
      {/* ========================================================================= */}
      {phonePairModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '440px', textAlign: 'center' }}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>📱 Open App on Phone</h3>
              <button onClick={() => setPhonePairModalOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#4b5563' }}>
                Scan this QR code with your smartphone camera to immediately open the Reflex Courier web app on your phone!
              </p>

              <div style={styles.qrCanvasContainer}>
                {phoneUrlQr ? (
                  <img src={phoneUrlQr} alt="Phone Connect QR" style={styles.qrImage} />
                ) : (
                  <p>Generating link QR...</p>
                )}
              </div>

              <p style={{ margin: '12px 0 4px', fontSize: '0.85rem', color: '#6b7280' }}>
                Or type this URL directly into your mobile phone's browser:
              </p>
              <code style={styles.qrTokenText}>
                http://{localIpAddress}:{window.location.port || '5173'}
              </code>

              <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.85rem', color: '#166534' }}>
                ✅ Make sure your phone is connected to the same Wi-Fi network as this computer.
              </div>

              <button
                onClick={() => setPhonePairModalOpen(false)}
                style={{ ...styles.modalPrimaryBtn, width: '100%', marginTop: '16px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Comprehensive Inline Styles
const styles = {
  appContainer: {
    maxWidth: '1140px',
    margin: '0 auto',
    padding: '20px 16px 60px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#1f2937',
    boxSizing: 'border-box'
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid #e5e7eb',
    flexWrap: 'wrap',
    gap: '16px'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoBadge: {
    fontSize: '2rem',
    backgroundColor: '#eff6ff',
    padding: '8px',
    borderRadius: '12px',
    border: '1px solid #bfdbfe'
  },
  navTitle: {
    fontSize: '1.6rem',
    fontWeight: '800',
    margin: 0,
    color: '#111827',
    letterSpacing: '-0.02em'
  },
  navSubtitle: {
    margin: '2px 0 0',
    fontSize: '0.85rem',
    color: '#6b7280'
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  connectionStatus: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: color,
    backgroundColor: '#f9fafb',
    padding: '6px 10px',
    borderRadius: '20px',
    border: '1px solid #e5e7eb'
  }),
  statusDot: (color) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color
  }),
  phonePairBtn: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  dbInspectBtn: {
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  createBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
  },
  createBtnLarge: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '12px'
  },
  twoScanBanner: {
    marginTop: '20px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
  },
  twoScanHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '8px'
  },
  twoScanTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#0f172a'
  },
  twoScanSub: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  stepCardsGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  stepCard: {
    flex: '1 1 280px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px'
  },
  stepNumberBadge: (num) => ({
    backgroundColor: num === 1 ? '#2563eb' : '#16a34a',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '4px 8px',
    borderRadius: '6px',
    letterSpacing: '0.05em'
  }),
  stepCardContent: {
    flex: 1
  },
  stepHeading: {
    margin: '0 0 4px',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#1e293b'
  },
  stepText: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#475569',
    lineHeight: '1.4'
  },
  stepArrow: {
    fontSize: '1.4rem',
    color: '#94a3b8',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center'
  },
  testingTipRow: {
    marginTop: '14px',
    padding: '10px 14px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    fontSize: '0.85rem',
    color: '#1e40af'
  },
  alertBanner: {
    marginTop: '16px',
    padding: '12px 16px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeAlertBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  filterBar: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  filterGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  filterTab: (active) => ({
    padding: '8px 14px',
    backgroundColor: active ? '#2563eb' : '#f3f4f6',
    color: active ? '#ffffff' : '#4b5563',
    border: '1px solid',
    borderColor: active ? '#2563eb' : '#e5e7eb',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer'
  }),
  searchAndScanBox: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.85rem',
    minWidth: '220px'
  },
  openScannerMainBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  refreshBtn: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  mainGrid: {
    marginTop: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '18px'
  },
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  cardTopBar: {
    padding: '14px 16px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f3f4f6'
  },
  cardDeliveryId: {
    fontWeight: '800',
    fontSize: '1.05rem',
    color: '#111827',
    marginRight: '8px'
  },
  cardQrToken: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontFamily: 'monospace'
  },
  statusBadge: (color) => ({
    padding: '3px 9px',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: '700',
    backgroundColor: color || '#6b7280',
    color: '#ffffff',
    letterSpacing: '0.03em'
  }),
  cardStepBanner: (color) => ({
    backgroundColor: `${color}15`,
    color: color,
    padding: '4px 16px',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${color}30`
  }),
  cardBody: {
    padding: '14px 16px',
    flex: 1
  },
  cardItemTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '10px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: '0.85rem',
    margin: '4px 0',
    gap: '8px'
  },
  detailLabel: {
    color: '#6b7280',
    fontWeight: '500',
    minWidth: '85px'
  },
  detailValBold: {
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right'
  },
  detailVal: {
    color: '#374151',
    textAlign: 'right'
  },
  phoneLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600'
  },
  timestampBox: {
    marginTop: '12px',
    padding: '8px 10px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem'
  },
  timeItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  timeLabel: {
    color: '#94a3b8',
    fontWeight: '600'
  },
  timeVal: {
    color: '#334155',
    fontWeight: '700',
    marginTop: '2px'
  },
  cardActions: {
    padding: '12px 16px',
    backgroundColor: '#fafafa',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  viewQrButton: {
    width: '100%',
    padding: '7px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#334155',
    cursor: 'pointer'
  },
  actionButtonGroup: {
    display: 'flex',
    gap: '6px'
  },
  primaryActionBtn: {
    flex: 2,
    padding: '9px',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  simulateScanBtn: {
    flex: 1,
    padding: '9px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  completedBadgeBox: {
    padding: '8px',
    backgroundColor: '#f0fdf4',
    color: '#15803d',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '0.8rem',
    fontWeight: '700'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 12px'
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    color: '#9ca3af',
    cursor: 'pointer'
  },
  presetsContainer: {
    padding: '12px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  presetTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  presetButtonsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '6px'
  },
  presetButton: {
    padding: '5px 10px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#334155',
    cursor: 'pointer'
  },
  formContainer: {
    padding: '16px 20px'
  },
  formRow: {
    display: 'flex',
    gap: '12px'
  },
  formGroup: {
    flex: 1,
    marginBottom: '14px'
  },
  formLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '4px'
  },
  formInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
    boxSizing: 'border-box'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  },
  modalSecondaryBtn: {
    padding: '9px 16px',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#374151',
    cursor: 'pointer'
  },
  modalPrimaryBtn: {
    padding: '9px 20px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  qrDisplayBody: {
    padding: '18px 24px'
  },
  qrCanvasContainer: {
    backgroundColor: '#ffffff',
    padding: '14px',
    borderRadius: '12px',
    border: '2px solid #e2e8f0',
    display: 'inline-block',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)'
  },
  qrImage: {
    width: '240px',
    height: '240px',
    display: 'block'
  },
  qrTokenBox: {
    marginTop: '12px'
  },
  qrTokenText: {
    display: 'inline-block',
    marginTop: '4px',
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#0f172a',
    border: '1px solid #cbd5e1'
  },
  qrInstructionCallout: {
    marginTop: '14px',
    padding: '10px 14px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    textAlign: 'left'
  },
  qrModalBtnGrid: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  },
  simulateDirectBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  printLabelBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  scannerHeaderRow: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb'
  },
  qrScannerMount: {
    width: '100%',
    padding: '10px',
    boxSizing: 'border-box'
  },
  scannerFooter: {
    padding: '10px 20px 16px',
    textAlign: 'center'
  },
  cancelScannerBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: '600',
    color: '#4b5563',
    cursor: 'pointer'
  },
  scanConfirmHeader: (color) => ({
    backgroundColor: color || '#2563eb',
    padding: '20px 24px',
    color: '#ffffff'
  }),
  scanStepPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '800',
    letterSpacing: '0.05em'
  },
  confirmModalDetails: {
    padding: '18px 24px'
  },
  stateTransitionCard: {
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px'
  },
  stateTransitionFlow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: '8px'
  },
  statusPill: (color) => ({
    padding: '4px 12px',
    borderRadius: '9999px',
    backgroundColor: color || '#6b7280',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '0.8rem'
  }),
  dbInspectorBody: {
    padding: '20px',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 120px)'
  },
  dbStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px'
  },
  dbStatCard: {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    textAlign: 'center'
  },
  dbStatNum: {
    display: 'block',
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#0f172a'
  },
  dbStatLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: '600'
  },
  dbTableContainer: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '8px'
  },
  dbTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem'
  },
  rawJsonBox: {
    backgroundColor: '#0f172a',
    color: '#38bdf8',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    overflowX: 'auto',
    maxHeight: '220px'
  },
  resetDbBtn: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: '6px 12px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer'
  }
};
