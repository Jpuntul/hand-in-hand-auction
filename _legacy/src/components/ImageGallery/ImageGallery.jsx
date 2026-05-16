import { useState, useRef, useEffect } from 'react';

const ImageGallery = ({ images, itemName }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const imageWrapperRef = useRef(null);

  const validImages = images.filter(img => img);

  if (validImages.length === 0) return null;

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevImage();
      else if (e.key === 'ArrowRight') nextImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentImageIndex]);

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
    setIsZoomed(false);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setIsZoomed(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % validImages.length);
    setIsZoomed(false);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    setIsZoomed(false);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <>
      {/* Image Thumbnails */}
      <div 
        ref={imageWrapperRef} 
        className="image-wrapper" 
        style={{ 
          display: 'flex', 
          gap: 16, 
          marginBottom: 24, 
          overflowX: 'auto', 
          justifyContent: 'flex-start', 
          scrollSnapType: 'x mandatory', 
          WebkitOverflowScrolling: 'touch', 
          scrollbarWidth: 'thin', 
          maxWidth: 770 
        }}
      >
        {validImages.map((img, idx) => (
          <div 
            key={idx} 
            style={{ 
              flex: '0 0 auto', 
              scrollSnapAlign: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
            onClick={() => openLightbox(idx)}
          >
            <img 
              src={img} 
              alt={`${itemName} - Image ${idx + 1}`} 
              loading="lazy"
              style={{ 
                maxWidth: 300, 
                borderRadius: 12, 
                boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)', 
                width: '100%', 
                objectFit: 'cover',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.3)';
              }}
            />
            {/* Zoom indicator */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              background: 'rgba(18, 44, 122, 0.8)',
              color: '#D4AF37',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              🔍 Click to zoom
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '20px'
          }}
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(212, 175, 55, 0.9)',
              border: 'none',
              color: '#122c7a',
              fontSize: '2rem',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              zIndex: 10001
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ×
          </button>

          {/* Image Container */}
          <div 
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={validImages[currentImageIndex]} 
              alt={`${itemName} - Image ${currentImageIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
                transition: 'transform 0.3s ease',
                boxShadow: '0 0 30px rgba(212, 175, 55, 0.4)'
              }}
              onClick={toggleZoom}
            />
          </div>

          {/* Navigation Buttons */}
          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(212, 175, 55, 0.9)',
                  border: 'none',
                  color: '#122c7a',
                  fontSize: '2rem',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1)'}
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(212, 175, 55, 0.9)',
                  border: 'none',
                  color: '#122c7a',
                  fontSize: '2rem',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(-50%) scale(1)'}
              >
                ›
              </button>
            </>
          )}

          {/* Image Counter & Zoom Hint */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(18, 44, 122, 0.9)',
            color: '#D4AF37',
            padding: '12px 24px',
            borderRadius: '30px',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}>
            <span>{currentImageIndex + 1} / {validImages.length}</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {isZoomed ? '🔍 Click to zoom out' : '🔍 Click to zoom in'}
            </span>
          </div>

          {/* Keyboard hint */}
          {validImages.length > 1 && (
            <div style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(18, 44, 122, 0.7)',
              color: '#D4AF37',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              opacity: 0.7
            }}>
              Use ← → arrow keys to navigate
            </div>
          )}
        </div>
      )}

      <style>{`
        .image-wrapper::-webkit-scrollbar {
          height: 8px;
        }
        .image-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .image-wrapper::-webkit-scrollbar-thumb {
          background: #D4AF37;
          border-radius: 10px;
        }
        .image-wrapper::-webkit-scrollbar-thumb:hover {
          background: #b8942d;
        }
      `}</style>
    </>
  );
};

export default ImageGallery;
