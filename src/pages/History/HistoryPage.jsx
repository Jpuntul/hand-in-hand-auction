import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, onSnapshot, setDoc, addDoc, query, orderBy } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import Toast from '../components/Toast/Toast';
import { useToast } from '../hooks/useToast';
import ImageGallery from '../components/ImageGallery';
import '../App.css';



function formatNumber(num) {
  return Number(num).toLocaleString('en-US');
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState(null);
  const [itemKey, setItemKey] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [pendingBid, setPendingBid] = useState(null);
  const [history, setHistory] = useState([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  const inputRef = useRef();
  const toast = useToast();

  // Parse item key from query params
  useEffect(() => {
    // Get user info from localStorage
    const info = JSON.parse(localStorage.getItem('userInfo'));
    setUserInfo(info);
    if (!info || !info.name || !info.email) {
      toast.error('Please register first to place bids');
      setTimeout(() => navigate('/'), 2000);
      return;
    }
    // Get item key from query params
    const params = new URLSearchParams(location.search);
    const key = params.get('item');
    setItemKey(key);
  }, [location, navigate]);

  // Fetch item data from Firestore
  useEffect(() => {
    if (!itemKey) return;
    const fetchItem = async () => {
      const itemDoc = await getDoc(doc(db, 'items_list', itemKey));
      setItemData(itemDoc.exists() ? itemDoc.data() : null);
    };
    fetchItem();
  }, [itemKey]);

  // Fetch bid history from Firestore
  useEffect(() => {
    if (!itemKey) return;
    const q = query(collection(db, 'history', itemKey, 'entries'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map(doc => doc.data());
      setHistory(rows);
    });
    return () => unsub();
  }, [itemKey]);

  // Show popup for 2 seconds
  useEffect(() => {
    if (popupVisible) {
      const timer = setTimeout(() => setPopupVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [popupVisible]);

  if (!itemKey) {
    return (
      <div className="main">
        <h1>Invalid item selected</h1>
        <p>Invalid item key.</p>
      </div>
    );
  }

  if (!itemData) {
    return <LoadingSpinner message="Loading item details..." size="large" />;
  }

  // Bid submission logic
  const handleBidClick = async () => {
    const amount = parseInt(bidAmount);
    if (!amount || amount < 1) {
      toast.error('Please enter a valid bid amount');
      return;
    }
    const startingBid = itemData?.starting_bid || 0;
    if (amount <= startingBid) {
      toast.error(`Minimum bid must be greater than THB ${formatNumber(startingBid)}`);
      return;
    }
    // Get current bid from Firestore (bids collection)
    const bidDoc = await getDoc(doc(db, 'bids', itemKey));
    const currentBid = bidDoc.exists() ? (bidDoc.data().bid || 0) : 0;
    const increment = 500;
    const minAllowed = Math.max(startingBid, currentBid + increment);
    if (amount < minAllowed) {
      toast.error(`Minimum next bid is THB ${formatNumber(minAllowed)}. Current: THB ${formatNumber(currentBid)} + Increment: THB ${formatNumber(increment)}`);
      return;
    }
    const itemName = itemData?.name || itemKey;
    setPendingBid({ itemKey, amount, itemName });
    setModalText(`Confirm your bid of THB ${formatNumber(amount)} for "${itemName}"?`);
    setModalVisible(true);
  };

  const handleSuggestBid = async () => {
    const startingBid = itemData?.starting_bid || 0;
    const bidDoc = await getDoc(doc(db, 'bids', itemKey));
    const currentBid = bidDoc.exists() ? (bidDoc.data().bid || 0) : 0;
    const increment = 500;
    const minAllowed = Math.max(startingBid, currentBid + increment);
    setBidAmount(minAllowed.toString());
  };

  const handleConfirmYes = async () => {
    if (!pendingBid) return;
    const { itemKey, amount } = pendingBid;
    // Update bid in Firestore
    await setDoc(doc(db, 'bids', itemKey), {
      bid: amount,
      bidder: userInfo.name,
      email: userInfo.email,
      phone: userInfo.phone,
      timestamp: Date.now(),
    });
    // Add to history subcollection
    await addDoc(collection(db, 'history', itemKey, 'entries'), {
      bid: amount,
      bidder: userInfo.name,
      email: userInfo.email,
      phone: userInfo.phone,
      timestamp: Date.now(),
    });
    // Add to watchlist in localStorage
    let storedItems = JSON.parse(localStorage.getItem('watchlistItems')) || [];
    if (!storedItems.includes(itemKey)) {
      storedItems.push(itemKey);
      localStorage.setItem('watchlistItems', JSON.stringify(storedItems));
    }
    setModalVisible(false);
    setPendingBid(null);
    setBidAmount('');
    setPopupVisible(true);
  };

  const handleConfirmNo = () => {
    setModalVisible(false);
    setPendingBid(null);
  };

  // Navigation handler
  const handleBack = () => {
    navigate('/bidding');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', color: '#9d8042', paddingBottom: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0.5rem', background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px 0 rgba(212,175,55,0.10)', border: '2px solid #D4AF37', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5rem' }}>
          <Link to="/bidding" style={{
            fontWeight: 600,
            fontSize: '1rem',
            textDecoration: 'underline',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            minWidth: 0
          }}>
            Bidding Room
          </Link>
        </div>
        <h1 id="item-title" style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.3rem, 4vw, 2rem)', color: '#D4AF37', textAlign: 'center', background: '#132d7a', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem', fontWeight: 800, letterSpacing: '0.01em', boxShadow: '0 2px 12px #132d7a22', border: '1.5px solid #D4AF37', maxWidth: 770, marginLeft: 'auto', marginRight: 'auto' }}>{itemData.name || 'Bid History'}</h1>
        <div id="main" style={{ padding: '0', margin: 0, maxWidth: 770, marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Image Gallery with Lightbox */}
          <ImageGallery 
            images={[itemData.picture1, itemData.picture2, itemData.picture3]}
            itemName={itemData.name || 'Item'}
          />
          <div id="item-description" className="auction-card" style={{ padding: '1.2rem', width: '100%', textAlign: 'left', marginBottom: '1.2rem', fontSize: '1.08rem', color: '#9d8042', backgroundColor: '#fbefd68f', border: '1.5px solid #D4AF37', borderRadius: 12, boxShadow: '0 1px 8px #D4AF3722', maxWidth: 770, marginLeft: 'auto', marginRight: 'auto' }}>
            {itemData.description && (
              <>
                <strong>Description:</strong><br /><br />
                {itemData.description}<br /><br />
                <strong>Starting Bid:</strong> THB {formatNumber(itemData.starting_bid || 0)} (THB 500 min. Increments)
              </>
            )}
          </div>
          <div className="bid-row" style={{ display: 'flex', gap: '0.5rem', margin: '1rem auto', maxWidth: 770, padding: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={inputRef}
              id="bid-input"
              type="number"
              min="1"
              placeholder="Enter your bid (THB)"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              className="auction-input flex-1"
              style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', padding: '0.7rem', borderRadius: 10, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 6px #D4AF3722', minWidth: '120px' }}
            />
            <button 
              onClick={handleSuggestBid}
              className="auction-btn" 
              style={{ 
                fontSize: 'clamp(0.85rem, 2vw, 1rem)', 
                fontWeight: 700, 
                borderRadius: 10, 
                padding: '0.7rem 0.8rem', 
                backgroundColor: '#132d7a',
                color: '#D4AF37',
                boxShadow: '0 2px 10px #D4AF3722', 
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap'
              }}
            >
              Suggest Bid
            </button>
            <button id="submit-btn" onClick={handleBidClick} className="auction-btn auction-btn-gold" style={{ fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', fontWeight: 700, borderRadius: 10, padding: '0.7rem 1rem', boxShadow: '0 2px 10px #D4AF3722', letterSpacing: '0.01em' }}>
              Submit Bid
            </button>
          </div>
          <div style={{ margin: '2rem auto 0 auto', maxWidth: 770, borderRadius: 12, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 8px #D4AF3722', overflow: 'hidden', width: '100%' }}>
            <table className="auction-table" style={{ width: '100%', fontSize: '0.98rem', borderRadius: 12, background: 'transparent' }}>
              <thead>
                <tr style={{ background: '#132d7a' }}>
                  <th style={{ color: '#D4AF37', padding: '0.9rem' }}>Bidder</th>
                  <th style={{ color: '#D4AF37', padding: '0.9rem' }}>Amount (THB)</th>
                  <th style={{ color: '#D4AF37', padding: '0.9rem' }}>Time</th>
                </tr>
              </thead>
              <tbody id="history-table">
                {history.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1.2rem', color: '#999' }}>No bids yet.</td></tr>
                ) : (
                  history.map((entry, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3e6c6' }}>
                      <td style={{ color: '#132c7a', fontWeight: 600 }}>{entry.bidder || '-'}</td>
                      <td style={{ color: '#D4AF37', fontWeight: 700 }}>{formatNumber(entry.bid)}</td>
                      <td style={{ color: '#9d8042' }}>{new Date(entry.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Popup for bid confirmation */}
      {popupVisible && (
        <div className="popup auction-card" style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#D4AF37', color: '#121212', zIndex: 1000, fontWeight: 'bold', borderRadius: 12, boxShadow: '0 2px 16px #D4AF3744', padding: '1.2rem 2.5rem', fontSize: '1.2rem' }}>
          Bid submitted!
        </div>
      )}
      {/* Confirmation Modal */}
      {modalVisible && (
        <div className="modal" style={{ display: 'flex', position: 'fixed', zIndex: 2000, left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <div className="modal-content auction-card" style={{ backgroundColor: '#FAF3E0', color: '#121212', textAlign: 'center', maxWidth: 400, width: '90%', borderRadius: 14, boxShadow: '0 2px 16px #D4AF3744', padding: '2rem 1.5rem' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>{modalText}</p>
            <button className="confirm-yes auction-btn auction-btn-gold" onClick={handleConfirmYes} style={{ margin: '0.5rem', fontWeight: 700, borderRadius: 8, padding: '0.7rem 1.5rem' }}>Yes</button>
            <button className="confirm-no auction-btn" onClick={handleConfirmNo} style={{ margin: '0.5rem', backgroundColor: '#999', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '0.7rem 1.5rem' }}>No</button>
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

export default HistoryPage;