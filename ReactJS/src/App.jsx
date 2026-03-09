import './App.css';
import LogIn from './pages/login';
import SignUp from './pages/signUp';
import Dashboard from './pages/Dashboard';
import POS from './pages/POs';
import Inventory from './pages/Inventorymanagement';
import Receipt from './pages/Receiptmanagement';
import Dashboardlayout from './components/dashboardlayout';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TransactionsProvider } from './context/transactionsContext';
import Unclaimed from './pages/UnclaimLaundry';
import Express from './pages/Express'; 
import Archive from './pages/Archive'; 
function App() {
  return (
    <TransactionsProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LogIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/POS" element={<POS />} />
          <Route path="/Unclaimed" element={<Unclaimed />} />
          <Route path="/Inventory" element={<Inventory />} />
          <Route path="/Receipt" element={<Receipt />} />
          <Route path="/Express" element={<Express/>} />
          <Route path="/Archive" element={<Archive/>} />
          <Route path="/dashboardlayout" element={<Dashboardlayout />} />
        </Routes>
      </Router>
    </TransactionsProvider>
  );
}

export default App;