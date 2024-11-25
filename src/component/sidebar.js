import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/sidebar.css';
import logo from '../images/download.png'; // Import the logo image

function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    navigate('/login');
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <img
          src={logo} // Use the imported image variable
          alt="Logo"
          className="sidebar-logo"
        />
        <h2>Menu</h2>
      </div>
      <ul className="sidebar-menu">
        <li>
          <a onClick={() => navigate('/convertir')}>Convertir</a>
        </li>
        <li>
          <a onClick={handleLogout}>Déconnexion</a>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;

