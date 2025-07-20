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
        const docRef = doc(db, 'items', itemId);
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
        const docRef = doc(db, 'items', itemId);
        await updateDoc(docRef, processedData);
        alert('Item updated successfully!');
      } else {
        // Add new item
        processedData.created_at = new Date();
        await addDoc(collection(db, 'items'), processedData);
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
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading item data...</p>
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
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8f9fa', 
      padding: '20px' 
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        padding: '30px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          borderBottom: '2px solid #dee2e6',
          paddingBottom: '15px'
        }}>
          <h1 style={{ 
            margin: 0, 
            color: '#343a40',
            fontSize: '28px',
            fontWeight: 'bold'
          }}>
            {isEditMode ? `Edit Item #${formData.item_no}` : 'Add New Item'}
          </h1>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Back to Dashboard
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '20px',
            marginBottom: '20px'
          }}>
            {/* Item Number */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold',
                color: '#495057'
              }}>
                Item Number *
              </label>
              <input
                type="number"
                name="item_no"
                value={formData.item_no}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: errors.item_no ? '2px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter item number"
              />
              {errors.item_no && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                  {errors.item_no}
                </div>
              )}
            </div>

            {/* Sponsor */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold',
                color: '#495057'
              }}>
                Sponsor
              </label>
              <input
                type="text"
                name="sponsor"
                value={formData.sponsor}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter sponsor name"
              />
            </div>
          </div>

          {/* Item Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: 'bold',
              color: '#495057'
            }}>
              Item Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px',
                border: errors.name ? '2px solid #dc3545' : '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter item name"
            />
            {errors.name && (
              <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                {errors.name}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: 'bold',
              color: '#495057'
            }}>
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              style={{
                width: '100%',
                padding: '10px',
                border: errors.description ? '2px solid #dc3545' : '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
              placeholder="Enter item description"
            />
            {errors.description && (
              <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                {errors.description}
              </div>
            )}
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '20px',
            marginBottom: '30px'
          }}>
            {/* Value */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold',
                color: '#495057'
              }}>
                Estimated Value (THB)
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleInputChange}
                step="0.01"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: errors.value ? '2px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter estimated value"
              />
              {errors.value && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                  {errors.value}
                </div>
              )}
            </div>

            {/* Starting Bid */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold',
                color: '#495057'
              }}>
                Starting Bid (THB)
              </label>
              <input
                type="number"
                name="starting_bid"
                value={formData.starting_bid}
                onChange={handleInputChange}
                step="0.01"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: errors.starting_bid ? '2px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter starting bid"
              />
              {errors.starting_bid && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                  {errors.starting_bid}
                </div>
              )}
            </div>

            {/* Bid Increment */}
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold',
                color: '#495057'
              }}>
                Bid Increment (THB) *
              </label>
              <input
                type="number"
                name="bid_increment"
                value={formData.bid_increment}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: errors.bid_increment ? '2px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter bid increment"
              />
              {errors.bid_increment && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
                  {errors.bid_increment}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            justifyContent: 'flex-end',
            borderTop: '1px solid #dee2e6',
            paddingTop: '20px'
          }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#ccc' : (isEditMode ? '#007bff' : '#28a745'),
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Item' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEdit;