// Custom hook for tracking analytics
import { useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

export const useAnalytics = () => {
  const trackItemView = async (itemId) => {
    try {
      const analyticsRef = doc(db, 'analytics', itemId);
      await setDoc(analyticsRef, {
        views: increment(1),
        lastViewed: serverTimestamp(),
        itemId
      }, { merge: true });
    } catch (error) {
      console.error('Error tracking item view:', error);
    }
  };

  const trackBidActivity = async (itemId, bidAmount) => {
    try {
      const analyticsRef = doc(db, 'analytics', itemId);
      await setDoc(analyticsRef, {
        totalBids: increment(1),
        lastBidAmount: bidAmount,
        lastBidTime: serverTimestamp(),
        itemId
      }, { merge: true });
    } catch (error) {
      console.error('Error tracking bid activity:', error);
    }
  };

  const trackSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) return;
    
    try {
      const searchRef = doc(db, 'search_analytics', searchTerm.toLowerCase());
      await setDoc(searchRef, {
        term: searchTerm.toLowerCase(),
        count: increment(1),
        lastSearched: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error tracking search:', error);
    }
  };

  return {
    trackItemView,
    trackBidActivity,
    trackSearch
  };
};
