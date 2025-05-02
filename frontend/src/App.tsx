import "./App.css";
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import StackDetail from "./pages/StackDetail";
import Images from "./pages/Images";

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/images"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Images
        </NavLink>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="stacks/:name" element={<StackDetail />} />
          <Route path="/images" element={<Images />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
