import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-[color:var(--text-secondary)]">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent)]"></div>
            <p>Loading...</p>
          </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Same normalisation as the Sidebar: role may be a string or { name }, in any case
  const userRole = (user.role?.name || user.role || '').toString().toLowerCase();
  if (!allowedRoles.map((role) => role.toLowerCase()).includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default RoleRoute;
