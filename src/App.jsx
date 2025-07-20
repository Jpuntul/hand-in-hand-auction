import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/LoginPage';
import BiddingRoom from './pages/BiddingRoomPage';
import Dashboard from './pages/admin/Dashboard';
import AddEdit from './pages/admin/AddEdit';
import './App.css'

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/bidding-room" element={<BiddingRoom />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/add-edit" element={<AddEdit />} />
      </Routes>
    </Router>
  )
}

export default App
