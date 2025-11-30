import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, doc, setDoc } from 'firebase/firestore';
import BackgroundImg from '../../assets/background.jpg';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import Toast from '../../components/Toast/Toast';
import { useToast } from '../../hooks/useToast';
import './BiddingRoomPage.css';

const BiddingRoom = () => {
  const [items, setItems] = useState({});
  const [bids, setBids] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('item_no'); // item_no, highest_bid, name, ending_soon
  const [filterBidStatus, setFilterBidStatus] = useState('all'); // all, with_bids, without_bids
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [userInfo, setUserInfo] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, item: null, amount: 0 });
  const [bidInputs, setBidInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    // Check user info from localStorage
    const savedUserInfo = localStorage.getItem('userInfo');
    if (!savedUserInfo) {
      toast.error('Please register first to access the bidding room');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
    const parsedUserInfo = JSON.parse(savedUserInfo);
    if (!parsedUserInfo.name || !parsedUserInfo.email) {
      toast.error('Please register first to access the bidding room');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
    setUserInfo(parsedUserInfo);

    let itemsLoaded = false;
    let bidsLoaded = false;

    const checkLoading = () => {
      if (itemsLoaded && bidsLoaded) {
        setLoading(false);
      }
    };

    // Subscribe to items_list collection
    const unsubItems = onSnapshot(collection(db, 'items_list'), (snapshot) => {
      const itemsObj = {};
      snapshot.forEach(doc => {
        itemsObj[doc.id] = doc.data();
      });
      setItems(itemsObj);
      itemsLoaded = true;
      checkLoading();
    });

    // Subscribe to bids collection
    const unsubBids = onSnapshot(collection(db, 'bids'), (snapshot) => {
      const bidsObj = {};
      snapshot.forEach(doc => {
        bidsObj[doc.id] = doc.data();
      });
      setBids(bidsObj);
      bidsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubItems();
      unsubBids();
    };
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
      toast.error('Please enter a valid bid amount');
      return;
    }

    // Check current bid and increment logic here
    const currentBid = bids[itemKey]?.bid || 0;
    const increment = items[itemKey]?.bid_increment || 500;
    const minAllowed = currentBid + increment;

    if (amount < minAllowed) {
      toast.error(`Minimum next bid is THB ${formatNumber(minAllowed)}. Current: THB ${formatNumber(currentBid)} + Increment: THB ${formatNumber(increment)}`);
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

    try {
      const { key: itemKey } = confirmModal.item;
      const amount = confirmModal.amount;

      // Submit bid to Firestore
      await setDoc(doc(db, 'bids', itemKey), {
        bid: amount,
        bidder: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone || '',
        timestamp: Date.now(),
      });

      // Add to history subcollection
      await addDoc(collection(db, 'history', itemKey, 'entries'), {
        bid: amount,
        bidder: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone || '',
        timestamp: Date.now(),
      });

      // Add to watchlist
      let storedItems = JSON.parse(localStorage.getItem('watchlistItems')) || [];
      if (!storedItems.includes(itemKey)) {
        storedItems.push(itemKey);
        localStorage.setItem('watchlistItems', JSON.stringify(storedItems));
      }

      setConfirmModal({ show: false, item: null, amount: 0 });
      setBidInputs(prev => ({ ...prev, [itemKey]: '' }));
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    } catch (error) {
      console.error('Error submitting bid:', error);
      toast.error('Failed to submit bid. Please try again.');
      setConfirmModal({ show: false, item: null, amount: 0 });
    }
  };

  const cancelBid = () => {
    setConfirmModal({ show: false, item: null, amount: 0 });
  };

  const filteredItems = Object.entries(items).filter(([key, item]) => {
    // Text search
    const query = searchQuery.toLowerCase();
    const name = item.name?.toLowerCase() || '';
    const number = item.item_no?.toString().toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    const sponsor = item.sponsor?.toLowerCase() || '';
    const textMatch = name.includes(query) || number.includes(query) || description.includes(query) || sponsor.includes(query);
    
    if (!textMatch) return false;

    // Bid status filter
    const hasBids = bids[key]?.bid > 0;
    if (filterBidStatus === 'with_bids' && !hasBids) return false;
    if (filterBidStatus === 'without_bids' && hasBids) return false;

    // Price range filter (based on current highest bid)
    const currentBid = bids[key]?.bid || item.starting_bid || 0;
    const minPrice = priceRange.min ? parseInt(priceRange.min) : 0;
    const maxPrice = priceRange.max ? parseInt(priceRange.max) : Infinity;
    if (currentBid < minPrice || currentBid > maxPrice) return false;

    return true;
  });

  const sortedItems = filteredItems.sort((a, b) => {
    const [keyA, itemA] = a;
    const [keyB, itemB] = b;

    switch (sortBy) {
      case 'item_no':
        const noA = parseInt(itemA.item_no) || 0;
        const noB = parseInt(itemB.item_no) || 0;
        return noA - noB;
      
      case 'highest_bid':
        const bidA = bids[keyA]?.bid || itemA.starting_bid || 0;
        const bidB = bids[keyB]?.bid || itemB.starting_bid || 0;
        return bidB - bidA; // Descending (highest first)
      
      case 'name':
        const nameA = itemA.name?.toLowerCase() || '';
        const nameB = itemB.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      
      default:
        return 0;
    }
  });

  if (loading) {
    return <LoadingSpinner message="Loading auction items..." size="large" />;
  }

  return (
    <div className="min-h-screen relative" style={{
      backgroundImage: `url(${BackgroundImg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: "'Inter', sans-serif",
      color: '#FAF3E0'
    }}>
      {/* Top Bar - Responsive */}
      <div className="fixed top-0 left-0 right-0 z-50 shadow-lg" style={{
        backgroundImage: `linear-gradient(rgba(211, 210, 192, 0.258), rgba(247, 251, 214, 0.228)), url(${BackgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: 'clamp(0.5rem, 2vw, 1rem) 0.5rem'
      }}>
        {/* Buttons Row */}
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={handleLogout}
            className="font-bold cursor-pointer rounded-lg"
            style={{
              backgroundColor: '#daa520ae',
              color: '#122c7a',
              border: 'none',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
              fontSize: 'clamp(0.75rem, 2vw, 0.85rem)'
            }}
          >
            Logout
          </button>
          
          <button
            onClick={handleWatchlist}
            className="font-bold cursor-pointer rounded-lg"
            style={{
              backgroundColor: '#daa520ae',
              color: '#122c7a',
              border: 'none',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
              fontSize: 'clamp(0.75rem, 2vw, 0.85rem)'
            }}
          >
            Watchlist
          </button>
        </div>

        {/* Title - Compact on Mobile */}
        <h1 className="mt-0 mb-2 text-center font-serif" style={{
          fontFamily: "'Playfair Display', serif",
          color: '#DAA520',
          fontSize: 'clamp(0.95rem, 3vw, 1.25rem)',
          lineHeight: '1.2'
        }}>
          Hand in Hand for Myanmar - Bidding Room
        </h1>
        
        {/* Welcome Message - Hidden on Small Mobile */}
        {userInfo && (
          <p className="mb-2 text-center font-bold hidden sm:block" style={{ 
            color: '#DAA520',
            fontSize: 'clamp(0.75rem, 2vw, 0.85rem)'
          }}>
            Welcome, {userInfo.name}!
          </p>
        )}
        
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="auction-input w-full max-w-3xl mx-auto block shadow-lg"
          style={{ 
            backgroundColor: '#3a5fcfb8', 
            color: '#daa520ae', 
            boxShadow: '0 0 5px rgba(212, 175, 55, 0.2)',
            fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
            padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 10px)',
            marginBottom: 'clamp(0.4rem, 1vw, 0.5rem)'
          }}
        />

        {/* Filter Controls - 4 columns, responsive sizing */}
        <div className="max-w-3xl mx-auto px-1 md:px-2">
          <div className="grid grid-cols-4 gap-1 md:gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs md:text-sm"
              style={{ 
                backgroundColor: '#3a5fcfb8', 
                color: '#FAF3E0',
                padding: '6px 2px',
                border: '2px solid #888',
                borderRadius: '8px',
                outline: 'none',
                width: '100%',
                minWidth: 0
              }}
            >
              <option value="item_no">Item #</option>
              <option value="highest_bid">High Bid</option>
              <option value="name">Name</option>
            </select>

            {/* Bid Status Filter */}
            <select
              value={filterBidStatus}
              onChange={(e) => setFilterBidStatus(e.target.value)}
              className="text-xs md:text-sm"
              style={{ 
                backgroundColor: '#3a5fcfb8', 
                color: '#FAF3E0',
                padding: '6px 2px',
                border: '2px solid #888',
                borderRadius: '8px',
                outline: 'none',
                width: '100%',
                minWidth: 0
              }}
            >
              <option value="all">All</option>
              <option value="with_bids">w/ Bids</option>
              <option value="without_bids">No Bids</option>
            </select>

            {/* Price Range - Min */}
            <input
              type="number"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
              className="text-xs md:text-sm"
              style={{ 
                backgroundColor: '#3a5fcfb8', 
                color: '#FAF3E0',
                padding: '6px 4px',
                border: '2px solid #888',
                borderRadius: '8px',
                outline: 'none',
                width: '100%',
                minWidth: 0
              }}
            />
            
            {/* Price Range - Max */}
            <input
              type="number"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
              className="text-xs md:text-sm"
              style={{ 
                backgroundColor: '#3a5fcfb8', 
                color: '#FAF3E0',
                padding: '6px 4px',
                border: '2px solid #888',
                borderRadius: '8px',
                outline: 'none',
                width: '100%',
                minWidth: 0
              }}
            />
          </div>
        </div>

        {/* Results Count */}
        <p className="text-center mt-2" style={{ 
          color: '#9d8042',
          fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)'
        }}>
          {sortedItems.length} of {Object.keys(items).length} items
        </p>
      </div>

      {/* Item List - Adjusted padding */}
      <div style={{ paddingTop: 'clamp(200px, 30vh, 240px)', paddingBottom: '2rem' }}>
        {sortedItems.map(([key, item]) => {
          const bidInfo = bids[key] || {};
          const bid = bidInfo.bid ? formatNumber(bidInfo.bid) : '-';
          const bidder = bidInfo.bidder || '-';
          const value = item.value ? `THB ${formatNumber(item.value)}` : '-';
          const starting_bid = item.starting_bid ? `THB ${formatNumber(item.starting_bid)}` : '-';

          return (
            <div
              key={key}
              className="auction-card max-w-lg mx-auto mb-6 p-4 shadow-lg"
            >
              <h2 className="mt-0 text-xl mb-2 pb-1" style={{
                color: '#DAA520',
                borderBottom: '2px solid #DAA520'
              }}>
                <span>#{item.item_no || '?'}</span> {item.name || key}
              </h2>
              
              <p style={{ color: '#9d8042' }} className='text-left'>
                <strong>Description:</strong><br />
                {item.description || 'No description available.'}
              </p>
              <p style={{ color: '#9d8042' }} className='text-left'>
                <strong>Value:</strong> {value}
              </p>
              <p style={{ color: '#9d8042' }} className='text-left'>
                <strong>Starting Bid:</strong> {starting_bid} (THB 500 Min. Increments)
              </p>
              <p style={{ color: '#9d8042' }} className='text-left'>
                <strong>Highest Bid:</strong> {bid}
              </p>
              <p style={{ color: '#9d8042' }} className='text-left'>
                <strong>Bidder:</strong> {bidder}
              </p>
              <p style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '0.95rem' }} className='text-left'>
                ⚡ Minimum Next Bid: THB {formatNumber((bids[key]?.bid || 0) + (item.bid_increment || 500))}
              </p>
              
              <div className="flex gap-2 mt-2 mb-2">
                <input
                  type="number"
                  placeholder="Enter bid amount"
                  value={bidInputs[key] || ''}
                  onChange={(e) => handleBidInputChange(key, e.target.value)}
                  className="auction-input flex-1 text-base"
                />
                <button
                  onClick={() => handleSubmitBid(key)}
                  className="auction-btn px-4 py-2 whitespace-nowrap"
                >
                  Submit Bid
                </button>
              </div>
              
              <a
                href={`/history?item=${key}`}
                className="inline-block mt-2 text-sm auction-highlight"
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

      {/* Toast Notifications */}
      {toast.toasts.map(t => {
        const toastType = t.type;
        const toastMessage = t.message;
        const toastDuration = t.duration;
        const toastId = t.id;
        return (
          <Toast
            key={toastId}
            type={toastType}
            message={toastMessage}
            duration={toastDuration}
            onClose={() => toast.removeToast(toastId)}
          />
        );
      })}
    </div>
  );
};

export default BiddingRoom;