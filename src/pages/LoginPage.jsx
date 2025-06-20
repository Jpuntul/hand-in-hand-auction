import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function LoginPage() {

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
    <div className="min-h-screen flex flex-col justify-center items-center relative">

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <h1 className="font-serif text-3xl text-yellow-400 text-center bg-blue-900/70 bg-opacity-80 py-3 px-6 rounded-lg mb-8 shadow-lg">
          Hand in Hand Bangkok Silent Auction
        </h1>
        
        <div className="flex flex-col w-full text-black bg-yellow-100/90 bg-opacity-90 p-6 rounded-xl shadow-2xl space-y-4">
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Your Name"
            required
            className="p-3 border-none rounded-lg text-lg bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
          />
          
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Email Address"
            required
            className="p-3 border-none rounded-lg text-lg bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
          />
          
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Phone Number"
            required
            minLength="10"
            className="p-3 border-none rounded-lg text-lg bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
          />
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="p-3 bg-yellow-500 hover:bg-yellow-600 text-blue-900 rounded-lg text-lg font-bold cursor-pointer transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? 'Registering...' : 'Enter Bidding Room'}
          </button>
        </div>
      </div>
    </div>
  );
}