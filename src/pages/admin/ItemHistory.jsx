import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';

const AdminItemHistory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('id');
  
  const [item, setItem] = useState(null);
  const [currentBid, setCurrentBid] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) {
      navigate('/admin');
      return;
    }

    const fetchItem = async () => {
      try {
        const itemDoc = await getDoc(doc(db, 'items_list', itemId));
        if (itemDoc.exists()) {
          setItem(itemDoc.data());
        } else {
          alert('Item not found');
          navigate('/admin');
        }
      } catch (error) {
        console.error('Error fetching item:', error);
        alert('Error loading item');
        navigate('/admin');
      }
    };

    // Subscribe to current bid
    const unsubBid = onSnapshot(doc(db, 'bids', itemId), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentBid(snapshot.data());
      }
    });

    // Subscribe to bid history
    const q = query(collection(db, 'history', itemId, 'entries'), orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => doc.data());
      setBidHistory(history);
      setLoading(false);
    });

    fetchItem();

    return () => {
      unsubBid();
      unsubHistory();
    };
  }, [itemId, navigate]);

  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-US');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return <LoadingSpinner message="Loading item history..." size="large" />;
  }

  if (!item) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="auction-card" style={{ textAlign: 'center', background: '#fbefd68f', border: '2px solid #D4AF37', borderRadius: 16, boxShadow: '0 4px 32px 0 rgba(212,175,55,0.10)', padding: '2.5rem 2rem' }}>
          <h1 style={{ color: '#D4AF37' }}>Item Not Found</h1>
          <button onClick={() => navigate('/admin')} className="auction-btn" style={{ marginTop: '1rem' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', padding: '2rem 0' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 32px 0 rgba(212,175,55,0.10)', border: '2px solid #D4AF37', padding: '2rem 1.5rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #D4AF37', paddingBottom: '1rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#D4AF37', margin: 0, letterSpacing: '0.01em', fontFamily: 'Playfair Display, serif' }}>
            Item #{item.item_no} - Bid History
          </h1>
          <button onClick={() => navigate('/admin')} className="auction-btn" style={{ fontWeight: 600, fontSize: '1rem', borderRadius: 8, padding: '0.6rem 1.2rem' }}>
            Back to Dashboard
          </button>
        </div>

        {/* Item Details */}
        <div className="auction-card" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1.5px solid #D4AF37', borderRadius: 12, background: '#fbefd68f' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D4AF37', marginTop: 0, marginBottom: '1rem', fontFamily: 'Playfair Display, serif' }}>
            {item.name}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                <strong>Starting Bid:</strong> THB {formatNumber(item.starting_bid || 0)}
              </p>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                <strong>Estimated Value:</strong> THB {formatNumber(item.value || 0)}
              </p>
            </div>
            <div>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                <strong>Bid Increment:</strong> THB {formatNumber(item.bid_increment || 500)}
              </p>
              {item.sponsor && (
                <p style={{ color: '#9d8042', marginBottom: '0.5rem' }}>
                  <strong>Sponsor:</strong> {item.sponsor}
                </p>
              )}
            </div>
          </div>

          {/* Current Highest Bid */}
          {currentBid && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a74520', borderRadius: 8, border: '2px solid #28a745' }}>
              <p style={{ color: '#28a745', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
                Current Highest Bid: THB {formatNumber(currentBid.bid)}
              </p>
              <p style={{ color: '#9d8042', marginTop: '0.5rem', marginBottom: 0 }}>
                Bidder: {currentBid.bidder} ({currentBid.email})
              </p>
            </div>
          )}
        </div>

        {/* Bid History Table */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#132d7a', marginBottom: '1rem', fontFamily: 'Playfair Display, serif' }}>
            All Bids ({bidHistory.length})
          </h2>
          
          {bidHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9d8042', background: '#fbefd68f', borderRadius: 12, border: '1.5px solid #D4AF37' }}>
              <p>No bids have been placed on this item yet.</p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 8px #D4AF3722', overflow: 'hidden' }}>
              <table className="auction-table" style={{ width: '100%', background: 'transparent' }}>
                <thead>
                  <tr style={{ background: '#132d7a' }}>
                    <th style={{ color: '#D4AF37', padding: '0.9rem', textAlign: 'left' }}>Bidder</th>
                    <th style={{ color: '#D4AF37', padding: '0.9rem', textAlign: 'left' }}>Email</th>
                    <th style={{ color: '#D4AF37', padding: '0.9rem', textAlign: 'right' }}>Amount (THB)</th>
                    <th style={{ color: '#D4AF37', padding: '0.9rem', textAlign: 'left' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bidHistory.map((bid, index) => (
                    <tr key={index} style={{ borderBottom: index < bidHistory.length - 1 ? '1px solid #f3e6c6' : 'none' }}>
                      <td style={{ padding: '0.9rem', color: '#132d7a', fontWeight: 600 }}>{bid.bidder}</td>
                      <td style={{ padding: '0.9rem', color: '#9d8042' }}>{bid.email}</td>
                      <td style={{ padding: '0.9rem', color: '#D4AF37', fontWeight: 700, textAlign: 'right' }}>
                        {formatNumber(bid.bid)}
                      </td>
                      <td style={{ padding: '0.9rem', color: '#9d8042' }}>{formatDate(bid.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statistics */}
        {bidHistory.length > 0 && (
          <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="auction-card" style={{ textAlign: 'center', padding: '1.2rem', border: '1.5px solid #D4AF37', borderRadius: 12 }}>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Total Bids</p>
              <p style={{ color: '#132d7a', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{bidHistory.length}</p>
            </div>
            <div className="auction-card" style={{ textAlign: 'center', padding: '1.2rem', border: '1.5px solid #D4AF37', borderRadius: 12 }}>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Unique Bidders</p>
              <p style={{ color: '#132d7a', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                {new Set(bidHistory.map(b => b.email)).size}
              </p>
            </div>
            <div className="auction-card" style={{ textAlign: 'center', padding: '1.2rem', border: '1.5px solid #D4AF37', borderRadius: 12 }}>
              <p style={{ color: '#9d8042', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Highest Bid</p>
              <p style={{ color: '#28a745', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
                THB {formatNumber(currentBid?.bid || 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminItemHistory;
