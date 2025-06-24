import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/LoginPage';
import BiddingRoom from './pages/BiddingRoomPage';
import './App.css'

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/bidding-room" element={<BiddingRoom />} />
      </Routes>
    </Router>
  )
}

export default App
