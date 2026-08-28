import { useEffect, useState } from "react";

function RiderBoard() {
  const [deliveries, setDeliveries] = useState([]);
  const [message, setMessage] = useState("");

  const riderId = 1;

  const fetchDeliveries = async () => {
    try {
      const response = await fetch("http://localhost:5000/deliveries");

      if (!response.ok) {
        throw new Error("Failed to fetch deliveries");
      }

      const data = await response.json();

      // Only show deliveries assigned to this rider
      const riderDeliveries = data.filter(
        (delivery) => delivery.assigned_rider_id === riderId
      );

      setDeliveries(riderDeliveries);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const updateStatus = async (deliveryId, status) => {
    try {
      const response = await fetch(
        `http://localhost:5000/deliveries/${deliveryId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: status,
            changed_by_user_id: riderId,
            note: `Rider updated delivery to ${status}`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setMessage(`Delivery status updated to ${status}!`);

      fetchDeliveries();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Rider Board</h2>

      {message && <p>{message}</p>}

      {deliveries.length === 0 ? (
        <p>No deliveries assigned to you.</p>
      ) : (
        <div>
          {deliveries.map((delivery) => (
            <div key={delivery.id}>
              <h3>Delivery #{delivery.id}</h3>

              <p>
                <strong>Customer:</strong> {delivery.customer_name}
              </p>

              <p>
                <strong>Phone:</strong> {delivery.customer_phone}
              </p>

              <p>
                <strong>Address:</strong> {delivery.address}
              </p>

              <p>
                <strong>Item:</strong> {delivery.item_description}
              </p>

              <p>
                <strong>Status:</strong> {delivery.status}
              </p>

              {delivery.status === "assigned" && (
                <button
                  onClick={() => updateStatus(delivery.id, "picked_up")}
                >
                  Mark Picked Up
                </button>
              )}

              {delivery.status === "picked_up" && (
                <button
                  onClick={() => updateStatus(delivery.id, "delivered")}
                >
                  Mark Delivered
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RiderBoard;