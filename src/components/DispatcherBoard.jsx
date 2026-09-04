import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = "https://reflex-backend-ot79.onrender.com";

function DispatcherBoard() {
  const [deliveries, setDeliveries] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/deliveries`);
      if (!response.ok) throw new Error("Failed to fetch deliveries");
      const data = await response.json();
      setDeliveries(data);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Real-time: refetch automatically whenever any status changes anywhere
  useEffect(() => {
    const socket = io(API_BASE);
    socket.on("statusUpdated", () => {
      fetchDeliveries();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const assignRider = async (deliveryId) => {
    try {
      const response = await fetch(`${API_BASE}/deliveries/${deliveryId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: 1 }),
      });
      if (!response.ok) throw new Error("Failed to assign rider");
      setMessage("✅ Rider assigned successfully!");
      fetchDeliveries();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case "requested": return "#94a3b8";
      case "assigned": return "#eab308";
      case "picked_up": return "#3b82f6";
      case "delivered": return "#22c55e";
      case "cancelled": return "#ef4444";
      default: return "#94a3b8";
    }
  };

  // Fixed: check the actual status, not just whether a rider ID happens to be present
  const needsAssignment = (delivery) => delivery.status === "requested";

  const openCount = deliveries.filter((d) => d.status === "requested").length;

  return (
    <div style={styles.appContainer}>
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          <div style={styles.logoBadge}>📋</div>
          <div>
            <h1 style={styles.navTitle}>Dispatcher Board</h1>
            <p style={styles.navSubtitle}>Assign incoming delivery requests to riders</p>
          </div>
        </div>
        <button onClick={fetchDeliveries} style={styles.refreshBtn}>🔄 Refresh</button>
      </header>

      <div style={styles.summaryBar}>
        <div style={styles.summaryPill}>
          <span style={styles.summaryNum}>{deliveries.length}</span>
          <span style={styles.summaryLabel}>Total</span>
        </div>
        <div style={styles.summaryPill}>
          <span style={{ ...styles.summaryNum, color: "#94a3b8" }}>{openCount}</span>
          <span style={styles.summaryLabel}>Awaiting Assignment</span>
        </div>
        <div style={styles.summaryPill}>
          <span style={{ ...styles.summaryNum, color: "#3b82f6" }}>
            {deliveries.filter((d) => d.status === "picked_up").length}
          </span>
          <span style={styles.summaryLabel}>In Transit</span>
        </div>
        <div style={styles.summaryPill}>
          <span style={{ ...styles.summaryNum, color: "#22c55e" }}>
            {deliveries.filter((d) => d.status === "delivered").length}
          </span>
          <span style={styles.summaryLabel}>Delivered</span>
        </div>
      </div>

      {message && (
        <div style={styles.alertBanner}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={styles.closeAlertBtn}>✕</button>
        </div>
      )}

      <main style={styles.mainGrid}>
        {loading ? (
          <div style={styles.emptyState}>
            <p>Loading delivery requests...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No delivery requests yet</h3>
            <p>New requests logged by retailer staff will appear here live.</p>
          </div>
        ) : (
          deliveries.map((delivery) => (
            <div key={delivery.id} style={styles.deliveryCard}>
              <div style={styles.cardTopBar}>
                <span style={styles.cardDeliveryId}>#{delivery.id}</span>
                <span style={styles.statusBadge(statusColor(delivery.status))}>
                  {delivery.status.toUpperCase()}
                </span>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.cardItemTitle}>{delivery.item_description}</div>

                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Customer:</span>
                  <span style={styles.detailValBold}>{delivery.customer_name}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Phone:</span>
                  <a href={`tel:${delivery.customer_phone}`} style={styles.phoneLink}>📞 {delivery.customer_phone}</a>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Address:</span>
                  <span style={styles.detailVal}>📍 {delivery.address}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Rider:</span>
                  <span style={styles.detailVal}>
                    {delivery.assigned_rider_id ? `Rider #${delivery.assigned_rider_id}` : "Not assigned"}
                  </span>
                </div>
              </div>

              <div style={styles.cardActions}>
                {needsAssignment(delivery) ? (
                  <button onClick={() => assignRider(delivery.id)} style={styles.assignBtn}>
                    🛵 Assign Rider
                  </button>
                ) : delivery.status === "cancelled" ? (
                  <div style={{ ...styles.assignedBadgeBox, backgroundColor: "#fef2f2", color: "#991b1b" }}>
                    ❌ Cancelled by Retailer
                  </div>
                ) : (
                  <div style={styles.assignedBadgeBox}>
                    {delivery.status === "delivered"
                      ? "✅ Delivered"
                      : `✅ Assigned to Rider #${delivery.assigned_rider_id}`}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </main>
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
  refreshBtn: { backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' },
  summaryBar: { marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  summaryPill: { flex: '1 1 140px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: '0 4px 12px -4px rgba(15,23,42,0.08)' },
  summaryNum: { display: 'block', fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' },
  summaryLabel: { fontSize: '0.75rem', color: '#64748b', fontWeight: '600' },
  alertBanner: { marginTop: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeAlertBtn: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' },
  mainGrid: { marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  deliveryCard: { backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px -4px rgba(15,23,42,0.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  cardTopBar: { padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' },
  cardDeliveryId: { fontWeight: '800', fontSize: '1.05rem', color: '#111827' },
  statusBadge: (color) => ({ padding: '3px 9px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: color, color: '#ffffff', letterSpacing: '0.03em' }),
  cardBody: { padding: '14px 16px', flex: 1 },
  cardItemTitle: { fontSize: '1.05rem', fontWeight: '700', color: '#1e293b', marginBottom: '10px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.85rem', margin: '6px 0', gap: '8px' },
  detailLabel: { color: '#6b7280', fontWeight: '500', minWidth: '75px' },
  detailValBold: { fontWeight: '700', color: '#111827', textAlign: 'right' },
  detailVal: { color: '#374151', textAlign: 'right' },
  phoneLink: { color: '#2563eb', textDecoration: 'none', fontWeight: '600' },
  cardActions: { padding: '12px 16px', backgroundColor: '#fafafa', borderTop: '1px solid #f3f4f6' },
  assignBtn: { width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' },
  assignedBadgeBox: { padding: '10px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '8px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700' },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1' },
};

export default DispatcherBoard;
