// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Mock hooks and utilities for demonstration - replace with your actual imports
const useItems = () => {
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setItems({
        'item1': { item_no: 1, name: 'Sample Item 1', sponsor: 'Sponsor A', description: 'Description 1' },
        'item2': { item_no: 2, name: 'Sample Item 2', sponsor: 'Sponsor B', description: 'Description 2' }
      });
      setLoading(false);
    }, 1000);
  }, []);

  return { items, loading, error };
};

const useBids = () => {
  const [bids, setBids] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setBids({
        'item1': { bid: '1500', bidder: 'John Doe' }
      });
      setLoading(false);
    }, 1000);
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
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Deleting item: ${itemKey}`);
        resolve();
      }, 1000);
    });
  }
};

const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
};

// Components
const LoadingSpinner = ({ size = 'medium' }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
  }}>
    <div style={{
      width: size === 'large' ? '50px' : '30px',
      height: size === 'large' ? '50px' : '30px',
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

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
        to={`/admin/history/${itemKey}`}
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0 }}>Admin Dashboard - Table View</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link 
            to="/admin/add-edit" 
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
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
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              minWidth: '200px'
            }}
          />
        </div>
      </div>

      {/* Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
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
            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Item #</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Sponsor</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Current Bid</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Bidder</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Actions</th>
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
                        <tr key={key} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: 'bold' }}>#{item.item_no || '?'}</span>
                          </td>
                          <td style={{ padding: '12px' }}>{item.name || key}</td>
                          <td style={{ padding: '12px' }}>{item.sponsor || 'No sponsor'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: 'bold', color: '#28a745' }}>
                              {formatNumber(bid?.bid || 0)}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>{bid?.bidder || '-'}</td>
                          <td style={{ padding: '12px' }}>
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
            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Item #</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Sponsor</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Description</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Actions</th>
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
                      <tr key={key} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 'bold' }}>#{item.item_no || '?'}</span>
                        </td>
                        <td style={{ padding: '12px' }}>{item.name || key}</td>
                        <td style={{ padding: '12px' }}>{item.sponsor || 'No sponsor'}</td>
                        <td style={{ padding: '12px', maxWidth: '300px' }}>
                          {item.description || 'No description available.'}
                        </td>
                        <td style={{ padding: '12px' }}>
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