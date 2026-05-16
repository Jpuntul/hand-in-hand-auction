import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './WatchlistPage.css';

const WatchlistPage = () => {
  const navigate = useNavigate();
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [bidsData, setBidsData] = useState({});
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check user info
    const savedUserInfo = localStorage.getItem('userInfo');
    if (!savedUserInfo) {
      alert('Guest information not found. Please register first.');
      navigate('/');
      return;
    }
    setUserInfo(JSON.parse(savedUserInfo));

    // Get watchlist from localStorage
    const storedItems = JSON.parse(localStorage.getItem('watchlistItems')) || [];
    setWatchlistItems(storedItems);

    // If no items, show empty state
    if (storedItems.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch all watchlist items data
    const fetchItemsData = async () => {
      const itemsObj = {};
      for (const itemId of storedItems) {
        try {
          const docSnap = await getDoc(doc(db, 'items_list', itemId));
          if (docSnap.exists()) {
            itemsObj[itemId] = docSnap.data();
          }
        } catch (error) {
          console.error(`Error fetching item ${itemId}:`, error);
        }
      }
      setItemsData(itemsObj);
      setLoading(false);
    };

    // Subscribe to bids for watchlist items
    const unsubscribers = storedItems.map(itemId => {
      return onSnapshot(doc(db, 'bids', itemId), (snapshot) => {
        if (snapshot.exists()) {
          setBidsData(prev => ({
            ...prev,
            [itemId]: snapshot.data()
          }));
        }
      });
    });

    fetchItemsData();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [navigate]);

  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-US');
  };

  const handleRemoveFromWatchlist = (itemId) => {
    if (window.confirm('Remove this item from your watchlist?')) {
      const updated = watchlistItems.filter(id => id !== itemId);
      setWatchlistItems(updated);
      localStorage.setItem('watchlistItems', JSON.stringify(updated));
      
      // Remove from local state
      const newItemsData = { ...itemsData };
      delete newItemsData[itemId];
      setItemsData(newItemsData);
      
      const newBidsData = { ...bidsData };
      delete newBidsData[itemId];
      setBidsData(newBidsData);
    }
  };

  const handleBackToBidding = () => {
    navigate('/bidding');
  };

  if (loading) {
    return <LoadingSpinner message="Loading watchlist..." size="large" />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', padding: '0.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px 0 rgba(212,175,55,0.10)', border: '2px solid #D4AF37', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #D4AF37', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 2rem)', fontWeight: 800, color: '#D4AF37', margin: 0, letterSpacing: '0.01em', fontFamily: 'Playfair Display, serif' }}>My Watchlist</h1>
          <button onClick={handleBackToBidding} className="auction-btn" style={{ fontWeight: 600, fontSize: 'clamp(0.85rem, 2vw, 1rem)', borderRadius: 8, padding: '0.5rem 1rem' }}>
            Back to Bidding Room
          </button>
        </div>

        {userInfo && (
          <p style={{ color: '#132d7a', fontWeight: 600, marginBottom: '1.5rem' }}>
            Welcome, {userInfo.name}!
          </p>
        )}

        {watchlistItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9d8042' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Your watchlist is empty</p>
            <p>Items you bid on will appear here</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {watchlistItems.map(itemId => {
              const item = itemsData[itemId];
              const bid = bidsData[itemId];
              
              if (!item) return null;

              const isUserHighestBidder = bid && bid.bidder === userInfo?.name;
              
              return (
                <div key={itemId} className="auction-card" style={{ padding: '1.5rem', border: isUserHighestBidder ? '2px solid #28a745' : '1.5px solid #D4AF37', borderRadius: 12, boxShadow: '0 1px 8px #D4AF3722', background: isUserHighestBidder ? '#f0fff4' : '#fbefd68f' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D4AF37', margin: 0, fontFamily: 'Playfair Display, serif' }}>
                      #{item.item_no || '?'} {item.name || itemId}
                    </h2>
                    {isUserHighestBidder && (
                      <span style={{ backgroundColor: '#28a745', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                        Leading Bid
                      </span>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                      <strong>Description:</strong> {item.description || 'No description'}
                    </p>
                    <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                      <strong>Estimated Value:</strong> THB {formatNumber(item.value || 0)}
                    </p>
                    <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                      <strong>Current Highest Bid:</strong> {bid ? `THB ${formatNumber(bid.bid)}` : 'No bids yet'}
                    </p>
                    {bid && bid.bidder && (
                      <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                        <strong>Current Highest Bidder:</strong> {bid.bidder}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <a
                      href={`/history?item=${itemId}`}
                      className="auction-btn auction-btn-gold"
                      style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: 8 }}
                    >
                      View Details & Bid
                    </a>
                    <button
                      onClick={() => handleRemoveFromWatchlist(itemId)}
                      className="auction-btn"
                      style={{ backgroundColor: '#dc3545', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: 8 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPage;
