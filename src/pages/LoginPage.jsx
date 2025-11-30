import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

/**
 * LoginPage component renders a registration form for users to enter their name, email, and phone number.
 * On submission, the user information is saved to Firestore and localStorage, and the user is navigated to the bidding room.
 *
 * Features:
 * - Collects user name, email, and phone number.
 * - Validates required fields and phone number length.
 * - Saves user data to Firestore and localStorage.
 * - Navigates to the bidding room upon successful registration.
 * - Displays loading state during submission.
 *
 * @component
 * @returns {JSX.Element} The rendered login/registration page for the auction.
 */
export default function Login() {

  const navigate = useNavigate();

  // State to manage form data and submission status
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Save to Firestore
      await addDoc(collection(db, "users"), formData);

      // Save locally (optional)
      localStorage.setItem('userInfo', JSON.stringify(formData));
      console.log('User registered:', formData);

      navigate('/bidding-room', { state: { user: formData } });

    } catch (error) {
      alert('Something went wrong. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div style={{ minHeight: '100vh', background: 'url("/background.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
      <div className="auction-card" style={{
        width: '100%',
        maxWidth: 440,
        margin: '1rem auto',
        padding: '1.5rem 1rem',
        boxShadow: '0 4px 32px 0 rgba(212,175,55,0.13)',
        border: '2px solid #D4AF37',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.98)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Optional logo area */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <img src="/logo-auction.png" alt="Auction Logo" style={{ height: 54, marginBottom: 0, filter: 'drop-shadow(0 2px 6px #D4AF37AA)' }} onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(1.3rem, 5vw, 2.1rem)',
          color: '#D4AF37',
          textAlign: 'center',
          background: '#132d7a',
          borderRadius: 10,
          padding: '0.7rem 1rem',
          marginBottom: '1.5rem',
          fontWeight: 800,
          letterSpacing: '0.01em',
          boxShadow: '0 2px 12px #132d7a22',
          border: '1.5px solid #D4AF37',
        }}>
          Hand in Hand Bangkok Silent Auction
        </h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Your Name"
            required
            className="auction-input"
            style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.13rem)', padding: '0.85rem', borderRadius: 10, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 6px #D4AF3722' }}
          />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Email Address"
            required
            className="auction-input"
            style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.13rem)', padding: '0.85rem', borderRadius: 10, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 6px #D4AF3722' }}
          />
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Phone Number"
            required
            minLength="10"
            className="auction-input"
            style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.13rem)', padding: '0.85rem', borderRadius: 10, border: '1.5px solid #D4AF37', background: '#fffbe6', boxShadow: '0 1px 6px #D4AF3722' }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="auction-btn auction-btn-gold"
            style={{
              fontSize: '1.13rem',
              fontWeight: 800,
              borderRadius: 10,
              padding: '1rem',
              marginTop: '0.5rem',
              boxShadow: '0 2px 10px #D4AF3722',
              letterSpacing: '0.01em',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
              background: isSubmitting ? '#D4AF37AA' : '#D4AF37',
              color: '#132d7a',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transform: isSubmitting ? 'scale(1)' : 'scale(1.01)',
            }}
          >
            {isSubmitting ? 'Registering...' : 'Enter Bidding Room'}
          </button>
        </form>
      </div>
    </div>
  );
}