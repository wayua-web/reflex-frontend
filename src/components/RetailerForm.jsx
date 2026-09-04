import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { io } from "socket.io-client";

const API_BASE = "https://reflex-backend-ot79.onrender.com";

function RetailerForm() {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    address: "",
    item_description: "",
  });

  const [message, setMessage] = useState("");
  const [createdDelivery, setCreatedDelivery] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [myDeliveries, setMyDeliveries] = useState([]);

  const fetchMyDeliveries = async () => {
    try {
      const res = await fetch(`${API_BASE}/deliveries`);
      const data = await res.json();
      // Show this shop's own requests, newest first
      const mine = data.filter((d) => d.retailer_id === 1).sort((a, b) => b.id - a.id);
      setMyDeliveries(mine);
    } catch (err) {
      console.error("Failed to load deliveries", err);
    }
  };

  useEffect(() => {
    fetchMyDeliveries();
  }, []);

  // Real-time: refresh the list automatically whenever any status changes
  useEffect(() => {
    const socket = io(API_BASE);
    socket.on("statusUpdated", () => {
      fetchMyDeliveries();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailer_id: 1, ...formData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create delivery");
      }

      setMessage("Delivery request created successfully!");
      setCreatedDelivery(data);

      const qrImage = await QRCode.toDataURL(data.qr_token, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(qrImage);

      setFormData({
        customer_name: "",
        customer_phone: "",
        address: "",
        item_description: "",
      });

      fetchMyDeliveries();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setCreatedDelivery(null);
      setQrDataUrl("");
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

  const cancelOrder = async (deliveryId) => {
    const confirmed = window.confirm("Cancel this delivery? This cannot be undone.");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", note: "Cancelled by retailer" }),
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      fetchMyDeliveries();
    } catch (err) {
      alert(`Error cancelling order: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px" }}>
      <h2>Log New Delivery</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Customer Name</label>
          <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required />
        </div>
        <div>
          <label>Customer Phone</label>
          <input type="text" name="customer_phone" value={formData.customer_phone} onChange={handleChange} required />
        </div>
        <div>
          <label>Address</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} required />
        </div>
        <div>
          <label>Item Description</label>
          <input type="text" name="item_description" value={formData.item_description} onChange={handleChange} required />
        </div>
        <button type="submit">Create Delivery</button>
      </form>

      {message && <p>{message}</p>}

      {createdDelivery && qrDataUrl && (
        <div style={{ marginTop: "20px", padding: "16px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h3 style={{ marginTop: 0 }}>Delivery #{createdDelivery.id} — QR Code</h3>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Print this and attach it to the package.
          </p>
          <img src={qrDataUrl} alt={`QR code for delivery ${createdDelivery.id}`} style={{ display: "block", margin: "0 auto" }} />
          <p style={{ fontSize: "0.75rem", color: "#888", textAlign: "center", wordBreak: "break-all" }}>
            {createdDelivery.qr_token}
          </p>
          <button onClick={() => window.print()} style={{ width: "100%", marginTop: "10px" }}>
            🖨️ Print QR Label
          </button>
        </div>
      )}

      <div style={{ marginTop: "32px" }}>
        <h3>Your Recent Orders</h3>
        {myDeliveries.length === 0 ? (
          <p style={{ color: "#888", fontSize: "0.85rem" }}>No orders yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myDeliveries.map((d) => (
              <div key={d.id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>#{d.id} — {d.item_description}</strong>
                  <span
                    style={{
                      backgroundColor: statusColor(d.status),
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: "700",
                    }}
                  >
                    {d.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>
                  For {d.customer_name} — {d.address}
                </div>
                {(d.status === "requested" || d.status === "assigned") && (
                  <button
                    onClick={() => cancelOrder(d.id)}
                    style={{
                      marginTop: "8px",
                      padding: "5px 12px",
                      backgroundColor: "#fff",
                      color: "#ef4444",
                      border: "1px solid #ef4444",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    ✕ Cancel Order
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RetailerForm;
