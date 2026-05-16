# Hand in Hand for Myanmar - Auction Platform

A modern, real-time charity auction platform built with React, Vite, and Firebase Firestore. Features live bidding, advanced search/filtering, and comprehensive admin controls.

## ✨ Features

- 🔥 **Real-time Bidding** - Live bid updates using Firebase Firestore
- 🔍 **Advanced Search & Filters** - Search by name/sponsor, filter by price range and bid status
- 💵 **Bid Validation** - Enforces minimum bid increments with confirmation modals
- 📋 **Watchlist** - Automatically track items you've bid on
- 📊 **Admin Dashboard** - Complete CRUD operations with analytics
- 🖼️ **Image Gallery** - Multiple images per item with lightbox view
- 📱 **Mobile Responsive** - Fully optimized for all devices
- 🔔 **Toast Notifications** - User-friendly feedback for all actions

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jpuntul/hand-in-hand-auction.git
   cd hand-in-hand-auction
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Create a `src/firebase.js` file with your Firebase configuration:
   ```javascript
   import { initializeApp } from 'firebase/app';
   import { getFirestore } from 'firebase/firestore';

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   export const db = getFirestore(app);
   ```

4. **Set up Firestore Collections**

   Create these collections in your Firebase Firestore:
   - `items_list` - Auction items
   - `bids` - Current highest bids
   - `history` - Bid history (subcollections under each item)

5. **Add sample data (optional)**
   
   Import the sample items from `items_list_sample.json` to Firestore

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
hand-in-hand-auction/
├── src/
│   ├── pages/                 # Page components (folder-based)
│   │   ├── Login/            # Guest registration page
│   │   ├── BiddingRoom/      # Main bidding interface
│   │   ├── History/          # Item details & bid history
│   │   ├── Watchlist/        # User's watchlist page
│   │   └── admin/
│   │       ├── Dashboard/    # Admin item management
│   │       ├── AddEdit/      # Add/edit items form
│   │       ├── Analytics/    # Analytics dashboard
│   │       └── ItemHistory/  # Admin bid history view
│   ├── components/           # Reusable components
│   │   ├── Toast/           # Toast notification system
│   │   ├── LoadingSpinner/  # Loading indicator
│   │   └── ImageGallery/    # Image lightbox gallery
│   ├── hooks/               # Custom React hooks
│   │   ├── useToast.js     # Toast notification hook
│   │   └── useAnalytics.js # Analytics tracking hook
│   ├── __test__/           # Unit tests
│   ├── firebase.js         # Firebase configuration
│   ├── App.jsx             # Main routing & navigation
│   └── main.jsx            # React entry point
├── public/                 # Static assets
├── package.json           # Dependencies
├── vite.config.js        # Vite configuration
└── README.md            # Project documentation
```

**Folder Structure Pattern:**
Each page/component is organized in its own folder with co-located CSS:
```
ComponentName/
├── ComponentName.jsx
└── ComponentName.css
```

## 🎯 Usage

### For Guests (Bidders)

1. **Register** 
   - Enter your name, email, and phone on the login page
   - Information is stored locally in browser

2. **Browse Items** 
   - View all auction items in the Bidding Room
   - Use search to find items by name, sponsor, or description
   - Filter by bid status (all/with bids/without bids)
   - Filter by price range
   - Sort by item number, highest bid, name, or ending soon

3. **Place Bids** 
   - Enter bid amount (must meet minimum increment)
   - System shows required next bid amount
   - Confirm bid in modal dialog
   - Receive toast notification on success/failure

4. **Track Items** 
   - Items you bid on automatically appear in Watchlist
   - Click item name to view detailed history

## 🎯 Usage

**For Guests:**
1. Register with name, email, and phone
2. Browse items with search and filters
3. Place bids (with increment validation and confirmation)
4. View your watchlist and bid history

**For Admins:**
- Access dashboard at `/admin`
- Add/edit/delete auction items
- View analytics and bid history
- Manage images (up to 3 per item)esource.data.phone is string &&
                      request.resource.data.timestamp is number;
    }
    
    // History - Read: all, Write: all (with validation)
    match /history/{itemId}/{historyId} {
      allow read: if true;
      allow create: if request.resource.data.bid is number &&
                       request.resource.data.bidder is string &&
                       request.resource.data.email is string &&
                       request.resource.data.phone is string &&
                       request.resource.data.timestamp is number;
    }
    
    // Analytics - Read: admins only, Write: all
    match /analytics/{doc} {
      allow read: if request.auth != null && request.auth.token.admin == true;
      allow write: if true;
    }
  }
}
```

### Environment Variables

For production deployment, create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Then update `src/firebase.js`:

```javascript
## 🔧 Configuration

**Firebase Setup:**
Update `src/firebase.js` with your Firebase credentials, or use environment variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

**Firestore Security Rules:**
Configure proper security rules in Firebase Console for production deployment. See Firebase documentation for best practices.
  email: string,                // Bidder's email
  phone: string,                // Bidder's phone
  timestamp: number             // Unix timestamp
}
```

#### `analytics` Collection
Tracks user interactions (optional):
```javascript
// Document ID: item_{item_no}
{
  item_no: number,
  name: string,
  views: number,                // Incremented on item view
  last_viewed: timestamp
}

// Document ID: search_{timestamp}
{
  term: string,                 // Search query
  timestamp: timestamp
}
## 📝 Database Structure

**Firestore Collections:**
- `items_list` - Auction items with details and images
- `bids` - Current highest bid for each item
- `history/{item_no}` - Complete bid history (subcollections)
- `analytics` - Track views, searches, and bid activity

**LocalStorage:**
- `userInfo` - Guest registration data (name, email, phone)
   netlify deploy --prod
   ```

   When prompted:
   - Publish directory: `dist`

## 🧪 Testing

Run unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test -- --watch
```

Current test coverage includes:
- Login page validation
- Bidding room search and filters
- Component rendering

## 🎨 Design System

### Color Palette
- **Primary Gold:** `#DAA520` (Goldenrod)
- **Primary Navy:** `#122c7a` (Deep Blue)
- **Success Green:** `#10b981` (Emerald)
- **Error Red:** `#ef4444` (Red)
- **Warning Yellow:** `#f59e0b` (Amber)
- **Background:** `#f8f9fa` (Light Gray)
- **Text:** `#2c3e50` (Dark Gray)

### Typography
- **Headers:** System font stack
- **Body:** Sans-serif
- **Monospace:** Courier (item numbers)

### Spacing
- Small: `0.5rem` (8px)
- Medium: `1rem` (16px)
- Large: `1.5rem` (24px)
- XL: `2rem` (32px)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. **Code Style**
   - Use functional components with hooks
   - Follow folder-based structure (component + CSS in same folder)
   - Use meaningful variable names
   - Add comments for complex logic

2. **Commit Messages**
   - Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
   - Be descriptive: "feat: add bid increment validation"

3. **Testing**
   - Write tests for new features
   - Ensure existing tests pass
   - Run `npm test` before committing

## 📊 Performance Optimizations

- **Code Splitting:** Route-based code splitting with React Router
- **Lazy Loading:** Images loaded on demand
- **Debouncing:** Search input debounced to reduce Firestore reads
- **Real-time Listeners:** Optimized snapshot listeners with cleanup
- **Memoization:** Used for expensive computations
- **CSS Organization:** Co-located styles reduce bundle size

## 🔒 Security Considerations

- **No Authentication:** Currently uses localStorage (demo only)
- **Client-side Validation:** All inputs validated before submission
- **Firestore Rules:** Should be configured for production
- **XSS Protection:** React escapes content by default
- **HTTPS:** Use HTTPS in production
- **Environment Variables:** Keep Firebase config secure

## 🐛 Known Issues & Future Enhancements

### Known Issues
- No server-side validation (client-side only)
- No email verification system
- No payment integration
- LocalStorage can be cleared by users

### Planned Features
- [ ] User authentication with Firebase Auth
- [ ] Email notifications for outbid scenarios
- [ ] Payment gateway integration
- [ ] Automated auction closing
- [ ] CSV export for admin
- [ ] Multi-language support (Thai/English)
- [ ] Dark mode theme
- [ ] Bid retraction with penalties
- [ ] Item categories/tags
- [ ] Advanced analytics dashboard

## 📄 License

This project is open source and available under the MIT License.

## 👥 Author

**Jpuntul**
- GitHub: [@Jpuntul](https://github.com/Jpuntul)

## 🙏 Acknowledgments

- Hand in Hand for Myanmar charity organization
- Firebase for real-time database infrastructure
- React community for excellent documentation
- All contributors and supporters

---

**Note:** This is a charity auction platform. Please ensure all data is handled responsibly and in compliance with relevant regulations.
## 🚀 Deployment

**Build for production:**
```bash
npm run build
```

**Deploy to Firebase Hosting:**
```bash
firebase init hosting
firebase deploy
```

**Deploy to Vercel/Netlify:**
- Public directory: `dist`
- Build command: `npm run build`

## 🛡️ Code Quality

**Pre-commit Hooks:**
- Automatically runs ESLint on staged files
- Validates build before commit
- Prevents broken code from being committed

**GitHub Actions CI:**
- Runs on every push and pull request
- Checks that the build succeeds
- Ensures code quality before deployment

## 🤝 Contributing

Contributions are welcome! Please:
- Use functional components with hooks
- Follow folder-based structure (component + CSS in same folder)
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Pre-commit hooks will automatically lint your code