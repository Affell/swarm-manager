import { useState, useEffect } from "react";
import "./App.css";
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import StackDetail from "./pages/StackDetail";
import Images from "./pages/Images";
import Cleanup from "./pages/Cleanup";
import { getVersion } from "./services/api";
import type { VersionInfo } from "./services/api";
import swarmLogo from "../public/swarm.svg";

function App() {
  const [version, setVersion] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Récupérer le mode depuis localStorage, sinon utiliser la préférence du système
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      return savedMode === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Appliquer le mode sombre au document
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
    // Sauvegarder le mode dans localStorage
    localStorage.setItem("darkMode", darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const versionInfo: VersionInfo = await getVersion();
        setVersion(versionInfo.version);
      } catch (error) {
        console.error("Failed to fetch version:", error);
        setVersion("unknown");
      }
    };

    fetchVersion();
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-container">
          <div className="brand">
            <img
              src={swarmLogo}
              alt="Swarm Manager Logo"
              className="app-logo"
            />
            <div className="brand-text">
              <h1>Swarm Manager</h1>
              {version && <span className="version-badge">v{version}</span>}
            </div>
          </div>
          <nav className="navbar">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              end
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/images"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Images
            </NavLink>
            <NavLink
              to="/cleanup"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Nettoyage
            </NavLink>
          </nav>
          <button
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="stacks/:name" element={<StackDetail />} />
          <Route path="/images" element={<Images />} />
          <Route path="/cleanup" element={<Cleanup />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
