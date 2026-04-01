import { Navigate, useLocation } from 'react-router-dom';

/**
 * Renders children only when a Sanctum token exists in localStorage.
 * Otherwise redirects to the login page and preserves the attempted URL for optional post-login use.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
