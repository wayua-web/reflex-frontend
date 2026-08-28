import RetailerForm from "./components/RetailerForm";
import DispatcherBoard from "./components/DispatcherBoard";
import RiderBoard from "./components/RiderBoard";
import "./App.css";

function App() {
  return (
    <div>
      <h1>Reflex</h1>
      <p>Delivery Tracking System</p>

      <RetailerForm />

      <hr />

      <DispatcherBoard />

      <hr />

      <RiderBoard />
    </div>
  );
}

export default App;