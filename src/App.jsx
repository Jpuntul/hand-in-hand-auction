import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/LoginPage';
import BiddingRoom from './pages/BiddingRoomPage';
import HistoryPage from './pages/HistoryPage';
import WatchlistPage from './pages/WatchlistPage';
import Dashboard from './pages/admin/Dashboard';
import AddEdit from './pages/admin/AddEdit';
import ItemHistory from './pages/admin/ItemHistory';
import './App.css'

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/bidding" element={<BiddingRoom />} />
        <Route path="/bidding-room" element={<BiddingRoom />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/add-edit" element={<AddEdit />} />
        <Route path="/admin/item-history" element={<ItemHistory />} />
      </Routes>
    </Router>
  )
}

export default App
