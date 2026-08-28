import RetailerForm from "./components/RetailerForm";
import DispatcherBoard from "./components/DispatcherBoard";
import "./App.css";

function App() {
  return (
    <div>
      <h1>Reflex</h1>
      <p>Delivery Tracking System</p>

      <RetailerForm />

      <hr />

      <DispatcherBoard />
    </div>
  );
}

export default App;