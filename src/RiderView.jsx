import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';

const CURRENT_RIDER_ID = 1; // John Kamau (Test Rider)

const getApiBaseUrl = () => {
  return 'https://reflex-backend-ot79.onrender.com';
};

// Small helper component: generates and displays a QR image from a token
function QrThumb({ token }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (token) {
      QRCode.toDataURL(token, { width: 140, margin: 1, errorCorrectionLevel: 'H' })
        .then((url) => {
          if (!cancelled) setDataUrl(url);
        })
        .catch((err) => console.error('QR generation failed', err));
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!dataUrl) return null;

  return (
    <div style={styles.qrThumbBox}>
      <img src={dataUrl} alt={`QR for ${token}`} style={styles.qrThumbImage} />
      <span style={styles.qrThumbToken}>{token}</span>
    </div>
  );
}

export default function RiderView() {
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBaseUrl());
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [activeScanDelivery, setActiveScanDelivery] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scannerRef = useRef(null);

  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
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
        badgeColor: '#eab308',
        actionColor: '#2563eb',
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
        badgeColor: '#3b82f6',
        actionColor: '#16a34a',
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
        badgeColor: '#22c55e',
        actionColor: '#6b7280',
        isCompleted: true
      };
    }

    if (s === 'cancelled') {
      return {
        scanNumber: null,
        scanTitle: 'Order Cancelled',
        stepBadge: 'CANCELLED',
        stepDescription: 'This order was cancelled by the retailer. No action needed.',
        currentStatusDisplay: 'CANCELLED',
        nextStatus: null,
        actionLabel: 'Cancelled',
        badgeColor: '#ef4444',
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

  const handleScanSuccess = (decodedText) => {
    const scanned = decodedText.trim();
    playScanBeep();

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

    // Security check: block scanning a delivery not actually assigned to this rider
    if (matched.assigned_rider_id !== CURRENT_RIDER_ID) {
      setActionFeedback({
        type: 'error',
        message: `❌ Delivery #${matched.id} is not assigned to you. Ask the dispatcher to assign it first.`
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
    setActiveScanDelivery({ delivery: matched, ...scanInfo });
  };

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
        (decodedText) => handleScanSuccess(decodedText),
        () => {}
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
        setActionFeedback({ type: 'info', message: `Delivery #${forDelivery.id} is already completed.` });
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
          body: JSON.stringify({ status: nextStatus, changed_by_user_id: CURRENT_RIDER_ID, note: noteText })
        });

        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);

        await response.json();

        setActionFeedback({
          type: 'success',
          message: `✅ [Scan #${scanNumber} Confirmed] Delivery #${deliveryId} status updated in database to "${nextStatus.toUpperCase()}"!`
        });

        await fetchDeliveries();
      } else {
        const now = new Date().toISOString();
        const updatedList = deliveries.map((d) => {
          if (d.id === deliveryId) {
            const hist = Array.isArray(d.status_history) ? [...d.status_history] : [];
            hist.push({ status: nextStatus, previous_status: d.status, timestamp: now, actor: `Rider #${CURRENT_RIDER_ID} (John Kamau)`, note: noteText });
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
      setActionFeedback({ type: 'error', message: `Failed to update status in database: ${err.message}` });
    } finally {
      setUpdating(false);
    }
  };

  // CRITICAL: only ever show deliveries actually assigned to THIS rider.
  // This is what prevents a rider from seeing or self-assigning unassigned ("requested") deliveries.
  const myDeliveries = deliveries.filter((d) => d.assigned_rider_id === CURRENT_RIDER_ID);

  const filteredDeliveries = myDeliveries.filter((d) => {
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'active' ? d.status === 'assigned' || d.status === 'picked_up' : d.status === statusFilter;

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
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          <div style={styles.logoBadge}>🏍️</div>
          <div>
            <h1 style={styles.navTitle}>Reflex Courier</h1>
            <p style={styles.navSubtitle}>Rider Portal & Two-Scan Verification</p>
          </div>
        </div>

        <div style={styles.connectionStatus(error ? '#ef4444' : '#10b981')}>
          <span style={styles.statusDot(error ? '#ef4444' : '#10b981')} />
          {error ? 'Offline / Local Mode' : 'Live Database Connected'}
        </div>
      </header>

      <div style={styles.twoScanBanner}>
        <div style={styles.twoScanHeader}>
          <h2 style={styles.twoScanTitle}>🔄 Two-Scan Delivery Workflow</h2>
          <span style={styles.twoScanSub}>Standard Operating Procedure</span>
        </div>

        <div style={styles.stepCardsGrid}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge(1)}>SCAN 1</div>
            <div style={styles.stepCardContent}>
              <h3 style={styles.stepHeading}>📦 Confirm Shop Pickup</h3>
              <p style={styles.stepText}>Collect parcel from shop → Scan QR → status becomes <code>picked_up</code>.</p>
            </div>
          </div>
          <div style={styles.stepArrow}>➔</div>
          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge(2)}>SCAN 2</div>
            <div style={styles.stepCardContent}>
              <h3 style={styles.stepHeading}>🏁 Confirm Final Delivery</h3>
              <p style={styles.stepText}>Reach customer → Scan the <strong>same QR</strong> → status becomes <code>delivered</code>.</p>
            </div>
          </div>
        </div>

        <div style={styles.testingTipRow}>
          💡 <strong>Testing solo:</strong> each package below shows its real QR code — use <strong>📷 Scan</strong> with your camera pointed at the screen, or <strong>⚡ Simulate Scan</strong> to skip the camera entirely.
        </div>
      </div>

      {actionFeedback && (
        <div
          style={{
            ...styles.alertBanner,
            backgroundColor: actionFeedback.type === 'success' ? '#ecfdf5' : actionFeedback.type === 'info' ? '#eff6ff' : '#fef2f2',
            borderColor: actionFeedback.type === 'success' ? '#10b981' : actionFeedback.type === 'info' ? '#3b82f6' : '#ef4444',
            color: actionFeedback.type === 'success' ? '#065f46' : actionFeedback.type === 'info' ? '#1e40af' : '#991b1b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>{actionFeedback.type === 'success' ? '✅' : actionFeedback.type === 'info' ? 'ℹ️' : '⚠️'}</span>
            <span style={{ fontWeight: '500' }}>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} style={styles.closeAlertBtn}>✕</button>
        </div>
      )}

      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <button onClick={() => setStatusFilter('all')} style={styles.filterTab(statusFilter === 'all')}>All ({myDeliveries.length})</button>
          <button onClick={() => setStatusFilter('assigned')} style={styles.filterTab(statusFilter === 'assigned')}>Ready for Pickup ({myDeliveries.filter((d) => d.status === 'assigned').length})</button>
          <button onClick={() => setStatusFilter('picked_up')} style={styles.filterTab(statusFilter === 'picked_up')}>In Transit ({myDeliveries.filter((d) => d.status === 'picked_up').length})</button>
          <button onClick={() => setStatusFilter('delivered')} style={styles.filterTab(statusFilter === 'delivered')}>Completed ({myDeliveries.filter((d) => d.status === 'delivered').length})</button>
        </div>

        <div style={styles.searchAndScanBox}>
          <input type="text" placeholder="🔍 Search package, customer, QR..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
          <button onClick={() => openScanner()} style={styles.openScannerMainBtn}>📷 Open QR Scanner</button>
          <button onClick={fetchDeliveries} style={styles.refreshBtn} title="Refresh">🔄</button>
        </div>
      </div>

      <main style={styles.mainGrid}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p>Loading assigned deliveries...</p>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No packages match your search</h3>
            <p>New deliveries will appear here once the dispatcher assigns them to you.</p>
          </div>
        ) : (
          filteredDeliveries.map((delivery) => {
            const scanInfo = getScanFlowInfo(delivery);

            return (
              <div key={delivery.id} style={styles.deliveryCard}>
                <div style={styles.cardTopBar}>
                  <span style={styles.cardDeliveryId}>#{delivery.id}</span>
                  <span style={styles.statusBadge(scanInfo.badgeColor)}>{scanInfo.currentStatusDisplay}</span>
                </div>

                <div style={styles.cardStepBanner(scanInfo.badgeColor)}>{scanInfo.stepBadge}</div>

                <div style={styles.cardBody}>
                  <div style={styles.cardItemTitle}>{delivery.item_description}</div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Recipient:</span>
                    <span style={styles.detailValBold}>{delivery.customer_name}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Phone:</span>
                    <a href={`tel:${delivery.customer_phone}`} style={styles.phoneLink}>📞 {delivery.customer_phone}</a>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Destination:</span>
                    <span style={styles.detailVal}>📍 {delivery.address}</span>
                  </div>

                  <div style={styles.timestampBox}>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Created</span>
                      <span style={styles.timeVal}>{new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Pickup</span>
                      <span style={styles.timeVal}>{delivery.pickup_time ? new Date(delivery.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Delivered</span>
                      <span style={styles.timeVal}>{delivery.delivery_time ? new Date(delivery.delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                  </div>

                  {!scanInfo.isCompleted && <QrThumb token={delivery.qr_token} />}
                </div>

                <div style={styles.cardActions}>
                  {!scanInfo.isCompleted ? (
                    <div style={styles.actionButtonGroup}>
                      <button onClick={() => openScanner(delivery)} style={{ ...styles.primaryActionBtn, backgroundColor: scanInfo.actionColor }}>
                        📷 Scan
                      </button>
                      <button
                        onClick={() => setActiveScanDelivery({ delivery, ...scanInfo })}
                        style={styles.simulateScanBtn}
                        title="Simulate scan without opening camera"
                      >
                        ⚡ Simulate Scan
                      </button>
                    </div>
                  ) : delivery.status === 'cancelled' ? (
                    <div style={{ ...styles.completedBadgeBox, backgroundColor: '#fef2f2', color: '#991b1b' }}>❌ Order Cancelled</div>
                  ) : (
                    <div style={styles.completedBadgeBox}>✅ Order Delivered & Closed</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {scannerOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '480px' }}>
            <div style={styles.scannerHeaderRow}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>📷 Live QR Code Scanner</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>Point your camera at the package's QR code</p>
              </div>
              <button onClick={closeScanner} style={styles.modalCloseBtn}>✕</button>
            </div>
            <div id="qr-reader" style={styles.qrScannerMount} />
            <div style={styles.scannerFooter}>
              <button onClick={closeScanner} style={styles.cancelScannerBtn}>Cancel Scanning</button>
            </div>
          </div>
        </div>
      )}

      {activeScanDelivery && !scannerOpen && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '480px' }}>
            <div style={styles.scanConfirmHeader(activeScanDelivery.actionColor)}>
              <span style={styles.scanStepPill}>{activeScanDelivery.stepBadge}</span>
              <h2 style={{ margin: '8px 0 4px', fontSize: '1.3rem', color: '#ffffff' }}>{activeScanDelivery.scanTitle}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.95, color: '#ffffff' }}>{activeScanDelivery.stepDescription}</p>
            </div>

            <div style={styles.confirmModalDetails}>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Delivery ID:</span><span style={styles.detailValBold}>#{activeScanDelivery.delivery.id}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>QR Token:</span><code style={{ fontSize: '0.85rem' }}>{activeScanDelivery.delivery.qr_token}</code></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Package:</span><span style={styles.detailValBold}>{activeScanDelivery.delivery.item_description}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Customer:</span><span style={styles.detailVal}>{activeScanDelivery.delivery.customer_name}</span></div>
              <div style={styles.detailRow}><span style={styles.detailLabel}>Address:</span><span style={styles.detailVal}>📍 {activeScanDelivery.delivery.address}</span></div>

              <div style={styles.stateTransitionCard}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>STATUS UPDATE:</span>
                <div style={styles.stateTransitionFlow}>
                  <span style={styles.statusPill(activeScanDelivery.badgeColor)}>{activeScanDelivery.currentStatusDisplay}</span>
                  <span style={{ fontSize: '1.2rem', color: activeScanDelivery.actionColor }}>➔</span>
                  <span style={styles.statusPill(activeScanDelivery.actionColor)}>{activeScanDelivery.nextStatus.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setActiveScanDelivery(null)} style={styles.modalSecondaryBtn} disabled={updating}>Cancel</button>
              <button
                onClick={() => updateDeliveryStatus(activeScanDelivery.delivery.id, activeScanDelivery.nextStatus, activeScanDelivery.scanNumber)}
                style={{ ...styles.modalPrimaryBtn, backgroundColor: activeScanDelivery.actionColor }}
                disabled={updating}
              >
                {updating ? 'Updating...' : `✅ Confirm & Update to "${activeScanDelivery.nextStatus.toUpperCase()}"`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { maxWidth: '1140px', margin: '0 auto', padding: '20px 16px 60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1f2937', boxSizing: 'border-box' },
  navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '16px' },
  navBrand: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoBadge: { fontSize: '2rem', backgroundColor: '#eff6ff', padding: '8px', borderRadius: '12px', border: '1px solid #bfdbfe' },
  navTitle: { fontSize: '1.6rem', fontWeight: '800', margin: 0, color: '#111827', letterSpacing: '-0.02em' },
  navSubtitle: { margin: '2px 0 0', fontSize: '0.85rem', color: '#6b7280' },
  connectionStatus: (color) => ({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', color, backgroundColor: '#f9fafb', padding: '6px 10px', borderRadius: '20px', border: '1px solid #e5e7eb' }),
  statusDot: (color) => ({ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }),
  twoScanBanner: { marginTop: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 6px 16px -6px rgba(15,23,42,0.12)' },
  twoScanHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' },
  twoScanTitle: { margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' },
  twoScanSub: { fontSize: '0.8rem', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' },
  stepCardsGrid: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  stepCard: { flex: '1 1 280px', display: 'flex', alignItems: 'flex-start', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' },
  stepNumberBadge: (num) => ({ backgroundColor: num === 1 ? '#2563eb' : '#16a34a', color: '#ffffff', fontSize: '0.75rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.05em' }),
  stepCardContent: { flex: 1 },
  stepHeading: { margin: '0 0 4px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' },
  stepText: { margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' },
  stepArrow: { fontSize: '1.4rem', color: '#94a3b8', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
  testingTipRow: { marginTop: '14px', padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.85rem', color: '#1e40af' },
  alertBanner: { marginTop: '16px', padding: '12px 16px', borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeAlertBtn: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' },
  filterBar: { marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  filterGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  filterTab: (active) => ({ padding: '8px 14px', backgroundColor: active ? '#2563eb' : '#f3f4f6', color: active ? '#ffffff' : '#4b5563', border: '1px solid', borderColor: active ? '#2563eb' : '#e5e7eb', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }),
  searchAndScanBox: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem', minWidth: '220px' },
  openScannerMainBtn: { backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' },
  refreshBtn: { backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem' },
  mainGrid: { marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  deliveryCard: { backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px -4px rgba(15,23,42,0.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'box-shadow 0.2s ease' },
  cardTopBar: { padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' },
  cardDeliveryId: { fontWeight: '800', fontSize: '1.05rem', color: '#111827' },
  statusBadge: (color) => ({ padding: '3px 9px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: color || '#6b7280', color: '#ffffff', letterSpacing: '0.03em' }),
  cardStepBanner: (color) => ({ backgroundColor: `${color}15`, color, padding: '4px 16px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.04em', borderBottom: `1px solid ${color}30` }),
  cardBody: { padding: '14px 16px', flex: 1 },
  cardItemTitle: { fontSize: '1.05rem', fontWeight: '700', color: '#1e293b', marginBottom: '10px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem', margin: '4px 0', gap: '8px' },
  detailLabel: { color: '#6b7280', fontWeight: '500', minWidth: '85px' },
  detailValBold: { fontWeight: '700', color: '#111827', textAlign: 'right' },
  detailVal: { color: '#374151', textAlign: 'right' },
  phoneLink: { color: '#2563eb', textDecoration: 'none', fontWeight: '600' },
  timestampBox: { marginTop: '12px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' },
  timeItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  timeLabel: { color: '#94a3b8', fontWeight: '600' },
  timeVal: { color: '#334155', fontWeight: '700', marginTop: '2px' },
  qrThumbBox: { marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#fafafa', border: '1px dashed #d1d5db', borderRadius: '10px' },
  qrThumbImage: { width: '64px', height: '64px', borderRadius: '4px' },
  qrThumbToken: { fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' },
  cardActions: { padding: '12px 16px', backgroundColor: '#fafafa', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '8px' },
  actionButtonGroup: { display: 'flex', gap: '6px' },
  primaryActionBtn: { flex: 1, padding: '10px', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' },
  simulateScanBtn: { flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' },
  completedBadgeBox: { padding: '10px', backgroundColor: '#f0fdf4', color: '#15803d', borderRadius: '8px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700' },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1' },
  spinner: { width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' },
  modalBackdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalCloseBtn: { background: 'none', border: 'none', fontSize: '1.2rem', color: '#9ca3af', cursor: 'pointer' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' },
  modalSecondaryBtn: { padding: '9px 16px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#374151', cursor: 'pointer' },
  modalPrimaryBtn: { padding: '9px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' },
  scannerHeaderRow: { padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' },
  qrScannerMount: { width: '100%', padding: '10px', boxSizing: 'border-box' },
  scannerFooter: { padding: '10px 20px 16px', textAlign: 'center' },
  cancelScannerBtn: { width: '100%', padding: '10px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', color: '#4b5563', cursor: 'pointer' },
  scanConfirmHeader: (color) => ({ backgroundColor: color || '#2563eb', padding: '20px 24px', color: '#ffffff' }),
  scanStepPill: { backgroundColor: 'rgba(255, 255, 255, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em' },
  confirmModalDetails: { padding: '18px 24px' },
  stateTransitionCard: { marginTop: '16px', padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' },
  stateTransitionFlow: { display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginTop: '8px' },
  statusPill: (color) => ({ padding: '4px 12px', borderRadius: '9999px', backgroundColor: color || '#6b7280', color: '#ffffff', fontWeight: '700', fontSize: '0.8rem' })
};
