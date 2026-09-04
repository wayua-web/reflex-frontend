import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import RetailerForm from "./components/RetailerForm";
import DispatcherBoard from "./components/DispatcherBoard";
import RiderView from "./RiderView";
import "./App.css";

function Home() {
  return (
    <div>
      <h1>Reflex</h1>
      <p>Delivery Tracking System</p>
      <nav>
        <Link to="/retailer">Retailer</Link> |{" "}
        <Link to="/dispatcher">Dispatcher</Link> |{" "}
        <Link to="/rider">Rider</Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/retailer" element={<RetailerForm />} />
        <Route path="/dispatcher" element={<DispatcherBoard />} />
        <Route path="/rider" element={<RiderView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;