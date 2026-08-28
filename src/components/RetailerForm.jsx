import { useState } from "react";

function RetailerForm() {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    address: "",
    item_description: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retailer_id: 1,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create delivery");
      }

      setMessage("Delivery request created successfully!");

      setFormData({
        customer_name: "",
        customer_phone: "",
        address: "",
        item_description: "",
      });
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Log New Delivery</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Customer Name</label>
          <input
            type="text"
            name="customer_name"
            value={formData.customer_name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Customer Phone</label>
          <input
            type="text"
            name="customer_phone"
            value={formData.customer_phone}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Item Description</label>
          <input
            type="text"
            name="item_description"
            value={formData.item_description}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit">Create Delivery</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

export default RetailerForm;