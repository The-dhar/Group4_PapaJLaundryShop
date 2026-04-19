import './App.css';
import LogIn from './pages/login';
import SignUp from './pages/signUp';
import Dashboard from './pages/Dashboard';
import POS from './pages/POs';
import Inventory from './pages/Inventorymanagement';
import Receipt from './pages/Receiptmanagement';
import Dashboardlayout from './components/dashboardlayout';
import ProtectedRoute from './components/ProtectedRoute';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TransactionsProvider } from './context/transactionsContext';
import Unclaimed from './pages/UnclaimLaundry';
import Express from './pages/Express'; 
import Archive from './pages/Archive'; 
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import ProfilePage from './pages/Profile';

function App() {
  return (
    <TransactionsProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LogIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/POS"
            element={
              <ProtectedRoute>
                <POS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <POS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Unclaimed"
            element={
              <ProtectedRoute>
                <Unclaimed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Inventory"
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Receipt"
            element={
              <ProtectedRoute>
                <Receipt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Report"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route path="/Analytics" element={<Navigate to="/Report" replace />} />
          <Route
            path="/Express"
            element={
              <ProtectedRoute>
                <Express />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Archive"
            element={
              <ProtectedRoute>
                <Archive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboardlayout"
            element={
              <ProtectedRoute>
                <Dashboardlayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </TransactionsProvider>
  );
}

export default App;