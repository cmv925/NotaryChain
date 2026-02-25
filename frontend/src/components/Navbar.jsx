import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Menu, X } from 'lucide-react';
import { Button } from './ui/button';

const Navbar = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f1825]/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <Shield className="w-8 h-8 text-blue-500 transition-transform group-hover:scale-110" />
            </div>
            <span className="text-xl font-bold text-white">
              Notary<span className="text-blue-500">Chain</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/verify" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
              Verify
            </Link>
            <Link to="/pricing" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
              Pricing
            </Link>
            <Link to="/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
              Login
            </Link>
            <Button
              onClick={() => navigate('/signup')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-all"
            >
              Sign Up
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-400 hover:text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-800 pt-4 space-y-3" data-testid="mobile-menu">
            <Link
              to="/verify"
              onClick={() => setMobileOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
            >
              Verify
            </Link>
            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
            >
              Pricing
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
            >
              Login
            </Link>
            <Button
              onClick={() => { navigate('/signup'); setMobileOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
            >
              Sign Up
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
