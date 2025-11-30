import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import './App.css';

// Lazy load all page components for code splitting
const Login = lazy(() => import('./pages/Login/LoginPage'));
const BiddingRoom = lazy(() => import('./pages/BiddingRoom/BiddingRoomPage'));
const HistoryPage = lazy(() => import('./pages/History/HistoryPage'));
const WatchlistPage = lazy(() => import('./pages/Watchlist/WatchlistPage'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard/Dashboard'));
const AddEdit = lazy(() => import('./pages/admin/AddEdit/AddEdit'));
const ItemHistory = lazy(() => import('./pages/admin/ItemHistory/ItemHistory'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
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
      </Suspense>
    </Router>
  );
}

export default App;
