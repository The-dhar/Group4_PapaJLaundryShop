import { Navigate, useLocation } from 'react-router-dom';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Renders children only when a Sanctum token exists and the user is not the shop owner.
 * Owner accounts are mobile-only; any owner session on web is cleared and redirected to login.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  const user = getStoredUser();
  if (user?.role === 'owner') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('ownerSelectedBranchId');
    return (
      <Navigate
        to="/"
        replace
        state={{ reason: 'owner_web_blocked', from: location }}
      />
    );
  }

  return children;
}
