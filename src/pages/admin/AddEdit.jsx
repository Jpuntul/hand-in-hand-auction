// src/pages/admin/AddEdit.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const AddEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';
  const isEditMode = mode === 'edit' && itemId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [formData, setFormData] = useState({
    item_no: '',
    name: '',
    description: '',
    sponsor: '',
    value: '',
    starting_bid: '',
    bid_increment: '500'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchItem = async () => {
      if (!isEditMode) {
        setInitialLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'items_list', itemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            item_no: data.item_no?.toString() || '',
            name: data.name || '',
            description: data.description || '',
            sponsor: data.sponsor || '',
            value: data.value?.toString() || '',
            starting_bid: data.starting_bid?.toString() || '',
            bid_increment: data.bid_increment?.toString() || '500'
          });
        } else {
          alert('Item not found');
          navigate('/admin');
        }
      } catch (error) {
        console.error('Error fetching item:', error);
        alert('Error loading item data');
        navigate('/admin');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchItem();
  }, [itemId, isEditMode, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.item_no.trim()) {
      newErrors.item_no = 'Item number is required';
    } else if (isNaN(formData.item_no) || parseInt(formData.item_no) <= 0) {
      newErrors.item_no = 'Item number must be a positive number';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.value && (isNaN(formData.value) || parseFloat(formData.value) < 0)) {
      newErrors.value = 'Value must be a valid positive number';
    }

    if (formData.starting_bid && (isNaN(formData.starting_bid) || parseFloat(formData.starting_bid) < 0)) {
      newErrors.starting_bid = 'Starting bid must be a valid positive number';
    }

    if (!formData.bid_increment || isNaN(formData.bid_increment) || parseInt(formData.bid_increment) <= 0) {
      newErrors.bid_increment = 'Bid increment must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Process form data
      const processedData = {
        item_no: parseInt(formData.item_no),
        name: formData.name.trim(),
        description: formData.description.trim(),
        sponsor: formData.sponsor.trim() || null,
        value: formData.value ? parseFloat(formData.value) : null,
        starting_bid: formData.starting_bid ? parseFloat(formData.starting_bid) : null,
        bid_increment: parseInt(formData.bid_increment),
        updated_at: new Date()
      };

      if (isEditMode) {
        // Update existing item
        const docRef = doc(db, 'items_list', itemId);
        await updateDoc(docRef, processedData);
        alert('Item updated successfully!');
      } else {
        // Add new item
        processedData.created_at = new Date();
        await addDoc(collection(db, 'items_list'), processedData);
        alert('Item added successfully!');
      }

      navigate('/admin');
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} item:`, error);
      alert(`Error ${isEditMode ? 'updating' : 'adding'} item. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? All changes will be lost.')) {
      navigate('/admin');
    }
  };

  if (initialLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="auction-card" style={{ textAlign: 'center', background: '#fbefd68f', border: '2px solid #D4AF37', borderRadius: 16, boxShadow: '0 4px 32px 0 rgba(212,175,55,0.10)', padding: '2.5rem 2rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #f3e6c6',
            borderTop: '3px solid #132d7a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#132d7a', fontWeight: 600 }}>Loading item data...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', padding: '2.5rem 0' }}>
      <div className="auction-card" style={{ maxWidth: 700, margin: '0 auto', border: '2px solid #D4AF37', borderRadius: 18, boxShadow: '0 6px 32px 0 rgba(212,175,55,0.13)', padding: '2.5rem 2.2rem 2rem 2.2rem', background: '#fff', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, borderBottom: '2px solid #D4AF37', paddingBottom: 18, textAlign: 'left' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#D4AF37', margin: 0, letterSpacing: '0.01em', fontFamily: 'Playfair Display, serif', textAlign: 'left' }}>{isEditMode ? `Edit Item #${formData.item_no}` : 'Add New Item'}</h1>
          <button type="button" className="auction-btn auction-btn-gray" onClick={handleCancel} style={{ fontWeight: 600, fontSize: '1rem', borderRadius: 8, padding: '0.6rem 1.2rem' }}>Back to Dashboard</button>
        </div>
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
            {/* Item Number */}
            <div>
              <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Item Number *</label>
              <input
                type="number"
                name="item_no"
                value={formData.item_no}
                onChange={handleInputChange}
                className={`auction-input${errors.item_no ? ' auction-input-error' : ''}`}
                placeholder="Enter item number"
                autoComplete="off"
                style={{ width: '100%', textAlign: 'left' }}
              />
              {errors.item_no && (
                <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.item_no}</div>
              )}
            </div>
            {/* Sponsor */}
            <div>
              <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Sponsor</label>
              <input
                type="text"
                name="sponsor"
                value={formData.sponsor}
                onChange={handleInputChange}
                className="auction-input"
                placeholder="Enter sponsor name"
                autoComplete="off"
                style={{ width: '100%', textAlign: 'left' }}
              />
            </div>
          </div>
          {/* Item Name */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Item Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`auction-input${errors.name ? ' auction-input-error' : ''}`}
              placeholder="Enter item name"
              autoComplete="off"
              style={{ width: '100%', textAlign: 'left' }}
            />
            {errors.name && (
              <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.name}</div>
            )}
          </div>
          {/* Description */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className={`auction-input${errors.description ? ' auction-input-error' : ''}`}
              placeholder="Enter item description"
              autoComplete="off"
              style={{ width: '100%', resize: 'vertical', minHeight: 80, textAlign: 'left' }}
            />
            {errors.description && (
              <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.description}</div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.2rem', marginBottom: '1.5rem' }}>
            {/* Value */}
            <div>
              <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Estimated Value (THB)</label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleInputChange}
                step="0.01"
                className={`auction-input${errors.value ? ' auction-input-error' : ''}`}
                placeholder="Enter estimated value"
                autoComplete="off"
                style={{ width: '100%', textAlign: 'left' }}
              />
              {errors.value && (
                <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.value}</div>
              )}
            </div>
            {/* Starting Bid */}
            <div>
              <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Starting Bid (THB)</label>
              <input
                type="number"
                name="starting_bid"
                value={formData.starting_bid}
                onChange={handleInputChange}
                step="0.01"
                className={`auction-input${errors.starting_bid ? ' auction-input-error' : ''}`}
                placeholder="Enter starting bid"
                autoComplete="off"
                style={{ width: '100%', textAlign: 'left' }}
              />
              {errors.starting_bid && (
                <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.starting_bid}</div>
              )}
            </div>
            {/* Bid Increment */}
            <div>
              <label style={{ fontWeight: 600, color: '#132d7a', marginBottom: 4, display: 'block', textAlign: 'left' }}>Bid Increment (THB) *</label>
              <input
                type="number"
                name="bid_increment"
                value={formData.bid_increment}
                onChange={handleInputChange}
                className={`auction-input${errors.bid_increment ? ' auction-input-error' : ''}`}
                placeholder="Enter bid increment"
                autoComplete="off"
                style={{ width: '100%', textAlign: 'left' }}
              />
              {errors.bid_increment && (
                <div className="auction-input-error-text" style={{ textAlign: 'left' }}>{errors.bid_increment}</div>
              )}
            </div>
          </div>
          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: 18 }}>
            <button type="button" className="auction-btn auction-btn-gray" onClick={handleCancel} style={{ fontWeight: 600, fontSize: '1rem', borderRadius: 8, padding: '0.7rem 1.5rem' }}>Cancel</button>
            <button type="submit" className={`auction-btn ${isEditMode ? 'auction-btn-blue' : 'auction-btn-gold'}`} disabled={loading} style={{ fontWeight: 700, fontSize: '1rem', borderRadius: 8, padding: '0.7rem 1.5rem' }}>
              {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Item' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEdit;