# Hand in Hand for Myanmar - Auction Platform

A modern, real-time charity auction platform built with React, Vite, and Firebase Firestore. Features a beautiful gold and navy theme with live bidding, watchlist functionality, and admin controls.

## ✨ Features

- 🎨 **Modern UI** - Clean, responsive design with gold/navy auction theme
- 🔥 **Real-time Updates** - Live bid updates using Firebase Firestore
- 👥 **Guest System** - Simple localStorage-based user registration
- 📊 **Admin Dashboard** - Complete CRUD operations for auction items
- 🖼️ **Image Support** - Multiple images per item with sliding gallery
- 📋 **Watchlist** - Track items you've bid on
- 📜 **Bid History** - Detailed history for each item
- ⚡ **Fast & Lightweight** - Built with Vite for optimal performance

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
src/
├── pages/
│   ├── LoginPage.jsx          # Guest registration
│   ├── BiddingRoomPage.jsx    # Main bidding interface
│   ├── HistoryPage.jsx        # Item details & bid history
│   ├── WatchlistPage.jsx      # User's watchlist
│   └── admin/
│       ├── Dashboard.jsx      # Admin item management
│       └── AddEdit.jsx        # Add/edit items
├── firebase.js                # Firebase configuration
├── index.css                  # Global auction theme
└── App.jsx                    # Main routing
```

## 🎯 Usage

### For Guests

1. **Register** - Enter your name, email, and phone on the login page
2. **Browse Items** - View all auction items in the Bidding Room
3. **Place Bids** - Enter bid amount and confirm
4. **Track Items** - Items you bid on appear in your Watchlist
5. **View History** - See detailed bid history for each item

### For Admins

1. **Access Dashboard** - Navigate to `/admin`
2. **Add Items** - Click "Add New Item" and fill in details
3. **Edit Items** - Click edit icon on any item
4. **Delete Items** - Click delete icon (with confirmation)
5. **Manage Images** - Add up to 3 image URLs per item

## 🔧 Configuration

### Firebase Rules

Recommended Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to items and bids
    match /items_list/{document=**} {
      allow read: if true;
      allow write: if request.auth != null; // Or your admin logic
    }
    
    match /bids/{document=**} {
      allow read: if true;
      allow write: if true; // Add your validation logic
    }
    
    match /history/{item}/{entry=**} {
      allow read: if true;
      allow write: if true; // Add your validation logic
    }
  }
}
```

### Environment Variables (Optional)

For production, consider using environment variables for Firebase config.

## 🛠️ Built With

- [React](https://reactjs.org/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [Firebase Firestore](https://firebase.google.com/docs/firestore) - Real-time database
- [React Router](https://reactrouter.com/) - Client-side routing
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS (partial)

## 📝 Data Model

### items_list Collection
```javascript
{
  item_no: number,
  name: string,
  description: string,
  sponsor: string | null,
  value: number | null,
  starting_bid: number | null,
  bid_increment: number,
  picture1: string,
  picture2: string,
  picture3: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

### bids Collection
```javascript
{
  bid: number,
  bidder: string,
  email: string,
  phone: string,
  timestamp: number
}
```

### history Subcollection
```javascript
{
  bid: number,
  bidder: string,
  email: string,
  phone: string,
  timestamp: number
}
```

## 🚀 Deployment

### Build for production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

### Deploy to Firebase Hosting (recommended)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 👥 Author

**Jpuntul**

## 🙏 Acknowledgments

- Hand in Hand for Myanmar charity organization
- All contributors and supporters

---

**Note:** This is a charity auction platform. Please ensure all data is handled responsibly and in compliance with relevant regulations.
