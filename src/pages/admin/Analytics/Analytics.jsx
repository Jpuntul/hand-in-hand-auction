import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../../../components/LoadingSpinner/LoadingSpinner';
import './Analytics.css';

const Analytics = () => {
  const [analytics, setAnalytics] = useState([]);
  const [searchTerms, setSearchTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to analytics data
    const analyticsQuery = query(
      collection(db, 'analytics'),
      orderBy('views', 'desc'),
      limit(20)
    );

    const unsubAnalytics = onSnapshot(analyticsQuery, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setAnalytics(data);
      setLoading(false);
    });

    // Subscribe to search analytics
    const searchQuery = query(
      collection(db, 'search_analytics'),
      orderBy('count', 'desc'),
      limit(10)
    );

    const unsubSearch = onSnapshot(searchQuery, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setSearchTerms(data);
    });

    return () => {
      unsubAnalytics();
      unsubSearch();
    };
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  return (
    <div className="analytics-container">
      <h1 className="analytics-title">Analytics Dashboard</h1>

      {/* Popular Items Section */}
      <div className="analytics-section">
        <h2>Most Popular Items</h2>
        <div className="analytics-table-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Views</th>
                <th>Total Bids</th>
                <th>Last Bid Amount</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map(item => (
                <tr key={item.id}>
                  <td>{item.itemId || item.id}</td>
                  <td>{item.views || 0}</td>
                  <td>{item.totalBids || 0}</td>
                  <td>
                    {item.lastBidAmount 
                      ? `THB ${item.lastBidAmount.toLocaleString()}` 
                      : '-'}
                  </td>
                  <td>
                    {item.lastBidTime 
                      ? new Date(item.lastBidTime.seconds * 1000).toLocaleString()
                      : item.lastViewed 
                        ? new Date(item.lastViewed.seconds * 1000).toLocaleString()
                        : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search Terms Section */}
      <div className="analytics-section">
        <h2>Popular Search Terms</h2>
        <div className="search-terms-grid">
          {searchTerms.map(term => (
            <div key={term.id} className="search-term-card">
              <div className="search-term-text">"{term.term}"</div>
              <div className="search-term-count">{term.count} searches</div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="analytics-summary">
        <div className="summary-card">
          <div className="summary-label">Total Items Tracked</div>
          <div className="summary-value">{analytics.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Views</div>
          <div className="summary-value">
            {analytics.reduce((sum, item) => sum + (item.views || 0), 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Bids Placed</div>
          <div className="summary-value">
            {analytics.reduce((sum, item) => sum + (item.totalBids || 0), 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Unique Search Terms</div>
          <div className="summary-value">{searchTerms.length}</div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
