import React from 'react';

const LoadingSpinner = ({ message = 'Loading...', size = 'medium' }) => {
  const sizes = {
    small: '30px',
    medium: '50px',
    large: '70px'
  };

  const spinnerSize = sizes[size] || sizes.medium;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: size === 'large' ? '100vh' : 'auto',
      padding: '2rem'
    }}>
      <div style={{
        width: spinnerSize,
        height: spinnerSize,
        border: '4px solid #f3e6c6',
        borderTop: '4px solid #132d7a',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p style={{
        marginTop: '1rem',
        color: '#132d7a',
        fontWeight: 600,
        fontSize: size === 'large' ? '1.2rem' : '1rem'
      }}>
        {message}
      </p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
