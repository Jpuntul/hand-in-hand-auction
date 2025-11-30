// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';


// Firebase imports
import { db } from '../../firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

// Hook to fetch items from Firestore
const useItems = () => {
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items_list'), (snapshot) => {
      const itemsObj = {};
      snapshot.forEach(doc => {
        itemsObj[doc.id] = doc.data();
      });
      setItems(itemsObj);
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { items, loading, error };
};

// Hook to fetch bids from Firestore
const useBids = () => {
  const [bids, setBids] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bids'), (snapshot) => {
      const bidsObj = {};
      snapshot.forEach(doc => {
        bidsObj[doc.id] = doc.data();
      });
      setBids(bidsObj);
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { bids, loading, error };
};

const useNotification = () => ({
  showNotification: (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(`${type.toUpperCase()}: ${message}`);
  }
});

const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);

  return {
    isOpen,
    data,
    openModal: (modalData) => {
      setData(modalData);
      setIsOpen(true);
    },
    closeModal: () => {
      setData(null);
      setIsOpen(false);
    }
  };
};


const itemsAPI = {
  delete: async (itemKey) => {
    // Delete item from Firestore
    await deleteDoc(doc(db, 'items_list', itemKey));
    // Optionally, delete associated bid
    await deleteDoc(doc(db, 'bids', itemKey));
    // Optionally, delete history subcollection (not implemented here)
  }
};

const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
};

// Components
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px',
            backgroundColor: '#ccc',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            {cancelText}
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [foldedSections, setFoldedSections] = useState({});
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { items, loading: itemsLoading, error: itemsError } = useItems();
  const { bids, loading: bidsLoading, error: bidsError } = useBids();
  const { showNotification } = useNotification();
  const deleteModal = useModal();

  // Calculate statistics with proper error handling
  const stats = useMemo(() => {
    try {
      const totalItems = Object.keys(items || {}).length;
      const itemsWithBids = Object.keys(bids || {}).length;
      const itemsWithoutBids = totalItems - itemsWithBids;
      
      const totalCurrentBid = Object.values(bids || {}).reduce((sum, bid) => {
        const bidAmount = parseFloat(bid?.bid) || 0;
        return sum + bidAmount;
      }, 0);

      return {
        totalItems,
        itemsWithBids,
        itemsWithoutBids,
        totalCurrentBid
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        totalItems: 0,
        itemsWithBids: 0,
        itemsWithoutBids: 0,
        totalCurrentBid: 0
      };
    }
  }, [items, bids]);

  // Filter and categorize items with proper error handling
  const { filteredWithBids, filteredWithoutBids } = useMemo(() => {
    try {
      const filterItems = (itemEntries) => {
        if (!searchQuery || !Array.isArray(itemEntries)) return itemEntries;
        
        const query = searchQuery.toLowerCase();
        return itemEntries.filter(([key, item]) => {
          if (!item) return false;
          return (
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.item_no && item.item_no.toString().includes(query)) ||
            (item.sponsor && item.sponsor.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query))
          );
        });
      };

      const allItems = Object.entries(items || {});
      const withBids = allItems.filter(([key]) => bids && bids[key]);
      const withoutBids = allItems.filter(([key]) => !bids || !bids[key]);

      return {
        filteredWithBids: filterItems(withBids),
        filteredWithoutBids: filterItems(withoutBids)
      };
    } catch (error) {
      console.error('Error filtering items:', error);
      return {
        filteredWithBids: [],
        filteredWithoutBids: []
      };
    }
  }, [items, bids, searchQuery]);

  const handleEdit = (itemKey) => {
    try {
      navigate(`/admin/add-edit?id=${itemKey}&mode=edit`);
    } catch (error) {
      console.error('Navigation error:', error);
      showNotification('Navigation error occurred', 'error');
    }
  };

  const handleDelete = (itemKey, itemName) => {
    if (!itemKey) {
      showNotification('Invalid item selected', 'error');
      return;
    }
    deleteModal.openModal({ itemKey, itemName });
  };

  const confirmDelete = async () => {
    if (!deleteModal.data?.itemKey) {
      showNotification('No item selected for deletion', 'error');
      return;
    }

    try {
      setLoading(true);
      await itemsAPI.delete(deleteModal.data.itemKey);
      showNotification('Item deleted successfully.', 'success');
      deleteModal.closeModal();
      // You might want to refresh the data here
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification('Error deleting item. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setFoldedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const ActionButtons = ({ itemKey, itemName }) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button 
        onClick={() => handleEdit(itemKey)}
        style={{
          padding: '4px 8px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Edit
      </button>
      <button 
        onClick={() => handleDelete(itemKey, itemName)}
        style={{
          padding: '4px 8px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Delete
      </button>
      <Link 
        to={`/admin/item-history?id=${itemKey}`}
        style={{
          padding: '4px 8px',
          backgroundColor: '#28a745',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          display: 'inline-block'
        }}
      >
        History
      </Link>
    </div>
  );

  // Loading state
  if (itemsLoading || bidsLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <LoadingSpinner size="large" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Error state
  if (itemsError || bidsError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error Loading Dashboard</h1>
        <p>Please try refreshing the page.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '15px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 4vw, 1.75rem)' }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link 
            to="/admin/add-edit" 
            style={{
              padding: '6px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: 'clamp(0.85rem, 2vw, 1rem)'
            }}
          >
            Add Items
          </Link>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            style={{
              padding: '6px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              minWidth: '150px',
              fontSize: 'clamp(0.85rem, 2vw, 1rem)'
            }}
          />
        </div>
      </div>

      {/* Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#495057' }}>
            {stats.totalItems}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>Total Items</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#d1ecf1',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #bee5eb'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5460' }}>
            {stats.itemsWithBids}
          </div>
          <div style={{ fontSize: '14px', color: '#0c5460' }}>Items with Bids</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#f8d7da',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #f5c6cb'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#721c24' }}>
            {stats.itemsWithoutBids}
          </div>
          <div style={{ fontSize: '14px', color: '#721c24' }}>Items without Bids</div>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#d4edda',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #c3e6cb'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#155724' }}>
            {formatNumber(stats.totalCurrentBid)}
          </div>
          <div style={{ fontSize: '14px', color: '#155724' }}>Total Current Bid</div>
        </div>
      </div>

      {/* Tables Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Items with Bids */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h2 style={{ margin: 0 }}>Items with Current Bids</h2>
            <button 
              onClick={() => toggleSection('withBids')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {foldedSections.withBids ? 'Show' : 'Hide'}
            </button>
          </div>
          
          {!foldedSections.withBids && (
            <div style={{ overflowX: 'auto', border: '1.5px solid #D4AF37', borderRadius: '14px', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#132d7ac9', color: '#D4AF37' }}>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Item #</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Name</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Sponsor</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Current Bid</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Bidder</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithBids.length === 0 ? (
                    <tr>
                      <td 
                        colSpan="6" 
                        style={{ 
                          padding: '20px', 
                          textAlign: 'center', 
                          color: '#6c757d',
                          fontStyle: 'italic'
                        }}
                      >
                        {searchQuery ? 'No matching items with bids found.' : 'No items with bids found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWithBids.map(([key, item]) => {
                      const bid = bids[key];
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid #f3e6c6' }}>
                          <td style={{ padding: '14px', color: '#DAA520', fontWeight: 700 }}>#{item.item_no || '?'}</td>
                          <td style={{ padding: '14px', color: '#132c7a', fontWeight: 600 }}>{item.name || key}</td>
                          <td style={{ padding: '14px', color: '#9d8042' }}>{item.sponsor || 'No sponsor'}</td>
                          <td style={{ padding: '14px', color: '#28a745', fontWeight: 700 }}>{formatNumber(bid?.bid || 0)}</td>
                          <td style={{ padding: '14px', color: '#132c7a' }}>{bid?.bidder || '-'}</td>
                          <td style={{ padding: '14px' }}>
                            <ActionButtons itemKey={key} itemName={item.name} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Items without Bids */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h2 style={{ margin: 0 }}>Items without Current Bids</h2>
            <button 
              onClick={() => toggleSection('withoutBids')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {foldedSections.withoutBids ? 'Show' : 'Hide'}
            </button>
          </div>
          
          {!foldedSections.withoutBids && (
            <div style={{ overflowX: 'auto', border: '1.5px solid #D4AF37', borderRadius: '14px', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#132d7ac9', color: '#D4AF37' }}>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Item #</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Name</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Sponsor</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Description</th>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #D4AF37' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithoutBids.length === 0 ? (
                    <tr>
                      <td 
                        colSpan="5" 
                        style={{ 
                          padding: '20px', 
                          textAlign: 'center', 
                          color: '#6c757d',
                          fontStyle: 'italic'
                        }}
                      >
                        {searchQuery ? 'No matching items without bids found.' : 'No items without bids found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWithoutBids.map(([key, item]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #f3e6c6' }}>
                        <td style={{ padding: '14px', color: '#DAA520', fontWeight: 700 }}>#{item.item_no || '?'}</td>
                        <td style={{ padding: '14px', color: '#132c7a', fontWeight: 600 }}>{item.name || key}</td>
                        <td style={{ padding: '14px', color: '#9d8042' }}>{item.sponsor || 'No sponsor'}</td>
                        <td style={{ padding: '14px', maxWidth: '300px', color: '#9d8042' }}>{item.description || 'No description available.'}</td>
                        <td style={{ padding: '14px' }}>
                          <ActionButtons itemKey={key} itemName={item.name} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Item"
        message={`Are you sure you want to delete "${deleteModal.data?.itemName || 'this item'}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={deleteModal.closeModal}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <LoadingSpinner size="large" />
          <p style={{ color: 'white', marginTop: '10px' }}>Deleting item...</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;