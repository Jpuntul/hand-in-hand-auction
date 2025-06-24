import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import BackgroundImg from '../assets/background.jpg';

const BiddingRoom = () => {
  const [items, setItems] = useState({});
  const [bids, setBids] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, item: null, amount: 0 });
  const [bidInputs, setBidInputs] = useState({});

  useEffect(() => {
    // Check user info from localStorage
    const savedUserInfo = localStorage.getItem('userInfo');
    if (!savedUserInfo) {
      alert('Guest information not found. Please register first.');
      // navigate('/'); - Replace with your routing logic
      return;
    }
    
    const parsedUserInfo = JSON.parse(savedUserInfo);
    if (!parsedUserInfo.name || !parsedUserInfo.email) {
      alert('Guest information not found. Please register first.');
      // navigate('/'); - Replace with your routing logic
      return;
    }
    
    setUserInfo(parsedUserInfo);
    
    // Initialize Firebase and fetch data
    // You'll need to uncomment and implement Firebase initialization
    // initializeFirebase();
  }, []);

  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-US');
  };

  const handleLogout = () => {
    if (window.confirm("Logging out will delete your current watchlist. Continue?")) {
      localStorage.removeItem('userInfo');
      localStorage.removeItem('watchlistItems');
      // navigate('/'); - Replace with your routing logic
      window.location.href = '/'; // or handle routing as needed
    }
  };

  const handleWatchlist = () => {
    // navigate('/watchlist'); - Replace with your routing logic
    window.location.href = '/watchlist'; // or handle routing as needed
  };

  const handleBidInputChange = (itemKey, value) => {
    setBidInputs(prev => ({
      ...prev,
      [itemKey]: value
    }));
  };

  const handleSubmitBid = async (itemKey) => {
    const amount = parseInt(bidInputs[itemKey]);
    if (!amount || amount < 1) {
      alert('Please enter a valid bid amount');
      return;
    }

    // Check current bid and increment logic here
    const currentBid = bids[itemKey]?.bid || 0;
    const increment = items[itemKey]?.bid_increment || 500;
    const minAllowed = currentBid + increment;

    if (amount < minAllowed) {
      alert(`Minimum next bid is THB ${formatNumber(minAllowed)} (Current: THB ${formatNumber(currentBid)} + Increment: THB ${formatNumber(increment)})`);
      return;
    }

    const itemName = items[itemKey]?.name || itemKey;
    setConfirmModal({
      show: true,
      item: { key: itemKey, name: itemName },
      amount: amount
    });
  };

  const confirmBid = async () => {
    if (!confirmModal.item) return;

    // Firebase bid submission logic would go here
    // await submitBidToFirebase(confirmModal.item.key, confirmModal.amount);
    
    // Add to watchlist
    let storedItems = JSON.parse(localStorage.getItem('watchlistItems')) || [];
    if (!storedItems.includes(confirmModal.item.key)) {
      storedItems.push(confirmModal.item.key);
      localStorage.setItem('watchlistItems', JSON.stringify(storedItems));
    }

    setConfirmModal({ show: false, item: null, amount: 0 });
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 2000);
    
    // Refresh data
    // fetchAndRenderItems();
  };

  const cancelBid = () => {
    setConfirmModal({ show: false, item: null, amount: 0 });
  };

  const filteredItems = Object.entries(items).filter(([key, item]) => {
    const query = searchQuery.toLowerCase();
    const name = item.name?.toLowerCase() || '';
    const number = item.item_no?.toString().toLowerCase() || '';
    return name.includes(query) || number.includes(query);
  });

  const sortedItems = filteredItems.sort((a, b) => {
    const noA = parseInt(a[1].item_no) || 0;
    const noB = parseInt(b[1].item_no) || 0;
    return noA - noB;
  });

  return (
    <div className="min-h-screen relative" style={{
      backgroundImage: `url(${BackgroundImg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: "'Inter', sans-serif",
      color: '#FAF3E0'
    }}>
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 text-center shadow-lg" style={{
        backgroundImage: `linear-gradient(rgba(211, 210, 192, 0.258), rgba(247, 251, 214, 0.228)), url(${BackgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: '1rem',
        paddingTop: '4.5rem'
      }}>
        <button
          onClick={handleLogout}
          className="absolute top-4 left-4 font-bold cursor-pointer z-50 px-4 py-2 rounded-lg"
          style={{
            backgroundColor: '#daa520ae',
            color: '#122c7a',
            border: 'none'
          }}
        >
          Logout
        </button>
        
        <button
          onClick={handleWatchlist}
          className="absolute top-4 right-4 font-bold cursor-pointer z-50 px-4 py-2 rounded-lg"
          style={{
            backgroundColor: '#daa520ae',
            color: '#122c7a',
            border: 'none'
          }}
        >
          Item Watchlist
        </button>

        <h1 className="mt-1 text-2xl font-serif" style={{
          fontFamily: "'Playfair Display', serif",
          color: '#DAA520'
        }}>
          <div>Hand in Hand for Myanmar</div>
          <div>Bidding Room</div>
        </h1>
        
        {userInfo && (
          <p className="text-base mb-4 font-bold" style={{ color: '#DAA520' }}>
            Welcome, {userInfo.name}!
          </p>
        )}
        
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-lg mx-auto block p-3 text-base rounded-lg border-none shadow-lg"
          style={{
            backgroundColor: '#3a5fcfb8',
            color: '#daa520ae',
            boxShadow: '0 0 5px rgba(212, 175, 55, 0.2)'
          }}
        />
      </div>

      {/* Item List */}
      <div className="pt-72 pb-8">
        {sortedItems.map(([key, item]) => {
          const bidInfo = bids[key] || {};
          const bid = bidInfo.bid ? formatNumber(bidInfo.bid) : '-';
          const bidder = bidInfo.bidder || '-';
          const value = item.value ? `THB ${formatNumber(item.value)}` : '-';
          const starting_bid = item.starting_bid ? `THB ${formatNumber(item.starting_bid)}` : '-';

          return (
            <div
              key={key}
              className="max-w-lg mx-auto mb-6 p-4 rounded-xl shadow-lg"
              style={{
                backgroundColor: '#fbefd68f',
                boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)'
              }}
            >
              <h2 className="mt-0 text-xl mb-2 pb-1" style={{
                color: '#DAA520',
                borderBottom: '2px solid #DAA520'
              }}>
                <span>#{item.item_no || '?'}</span> {item.name || key}
              </h2>
              
              <p style={{ color: '#9d8042' }}>
                <strong>Description:</strong><br />
                {item.description || 'No description available.'}
              </p>
              <p style={{ color: '#9d8042' }}>
                <strong>Value:</strong> {value}
              </p>
              <p style={{ color: '#9d8042' }}>
                <strong>Starting Bid:</strong> {starting_bid} (THB 500 Min. Increments)
              </p>
              <p style={{ color: '#9d8042' }}>
                <strong>Highest Bid:</strong> {bid}
              </p>
              <p style={{ color: '#9d8042' }}>
                <strong>Bidder:</strong> {bidder}
              </p>
              
              <div className="flex gap-2 mt-2 mb-2">
                <input
                  type="number"
                  placeholder="Enter bid amount"
                  value={bidInputs[key] || ''}
                  onChange={(e) => handleBidInputChange(key, e.target.value)}
                  className="flex-1 p-2 rounded-lg text-base border-none"
                  style={{
                    backgroundColor: '#fffbe6',
                    color: '#121212'
                  }}
                />
                <button
                  onClick={() => handleSubmitBid(key)}
                  className="px-4 py-2 rounded-lg font-bold cursor-pointer whitespace-nowrap hover:bg-yellow-600"
                  style={{
                    backgroundColor: '#132c7a',
                    color: '#dcdcdc',
                    border: 'none'
                  }}
                >
                  Submit Bid
                </button>
              </div>
              
              <a
                href={`/history?item=${key}`}
                className="inline-block mt-2 text-sm"
                style={{ color: '#9d8042' }}
              >
                View Detail & Bid History
              </a>
            </div>
          );
        })}
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-8 py-4 rounded-xl font-bold z-50" style={{
          backgroundColor: '#D4AF37',
          color: '#121212',
          boxShadow: '0 0 15px rgba(212, 175, 55, 0.4)'
        }}>
          Bid submitted!
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-white text-black p-6 rounded-xl text-center max-w-sm w-11/12" style={{
            backgroundColor: '#FAF3E0'
          }}>
            <p className="mb-4">
              Confirm your bid of THB {formatNumber(confirmModal.amount)} for "{confirmModal.item?.name}"?
            </p>
            <button
              onClick={confirmBid}
              className="mx-2 px-4 py-2 border-none rounded-lg font-bold cursor-pointer"
              style={{
                backgroundColor: '#D4AF37',
                color: '#122c7a'
              }}
            >
              Yes
            </button>
            <button
              onClick={cancelBid}
              className="mx-2 px-4 py-2 border-none rounded-lg font-bold cursor-pointer"
              style={{
                backgroundColor: '#999',
                color: '#fff'
              }}
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiddingRoom;