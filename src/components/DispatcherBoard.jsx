import { useEffect, useState } from "react";

function DispatcherBoard() {
  const [deliveries, setDeliveries] = useState([]);
  const [message, setMessage] = useState("");

  // Get all deliveries from the backend
  const fetchDeliveries = async () => {
    try {
      const response = await fetch("http://localhost:5000/deliveries");

      if (!response.ok) {
        throw new Error("Failed to fetch deliveries");
      }

      const data = await response.json();
      setDeliveries(data);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  // Fetch deliveries when the page loads
  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Assign the test rider to a delivery
  const assignRider = async (deliveryId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/deliveries/${deliveryId}/assign`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rider_id: 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to assign rider");
      }

      setMessage("Rider assigned successfully!");

      // Refresh the delivery list
      fetchDeliveries();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Dispatcher Board</h2>

      {message && <p>{message}</p>}

      {deliveries.length === 0 ? (
        <p>No delivery requests found.</p>
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

              <p>
                <strong>Rider:</strong>{" "}
                {delivery.assigned_rider_id
                  ? `Rider ${delivery.assigned_rider_id}`
                  : "Not assigned"}
              </p>

              {!delivery.assigned_rider_id && (
                <button onClick={() => assignRider(delivery.id)}>
                  Assign Rider
                </button>
              )}

              <hr />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DispatcherBoard;