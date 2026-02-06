import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../pages/auth/ChangePassword';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white text-gray-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-20">
          {/* Empty flex space on left */}
          <div className="flex-1"></div>

          {/* Logo - Centered */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <img
              src="/hyloc-logo.png"
              alt="Hyloc logo"
              className="h-12 w-12"
            />
            <h1 className="text-3xl font-bold">Hyloc Hydrotechnic Pvt Ltd</h1>
          </div>

          {/* User Info & Menu - Right aligned */}
          <div className="flex-1 flex justify-end items-center space-x-4 relative">
            {user && (
              <>
                <div className="hidden md:block relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold">
                      {(user.firstName?.[0] || 'U').toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition ${isProfileOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {user.role?.toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => { setIsChangePwdOpen(true); setIsProfileOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Change Password
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  </svg>
                </button>

                {/* Desktop dropdown only */}
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && user && (
          <div className="md:hidden pb-4 space-y-2">
            <div className="text-sm text-gray-600">
              {user.firstName} {user.lastName}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
              user.role === 'admin' 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {user.role?.toUpperCase()}
            </div>
            <button
              onClick={() => { setIsChangePwdOpen(true); setIsMenuOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-semibold"
            >
              Change Password
            </button>

            <button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-200 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        )}

        {/* Change Password Modal */}
        <ChangePasswordModal isOpen={isChangePwdOpen} onClose={() => setIsChangePwdOpen(false)} />
      </div>
    </nav>
  );
};

export default Navbar;
