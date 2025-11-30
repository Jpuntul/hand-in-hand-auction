# Firebase Security Rules

This file contains Firestore security rules for the Hand-in-Hand Auction application.

## Rules Overview

### Items List (`/items_list/{itemId}`)
- **Read**: Public (anyone can view auction items)
- **Write**: Authenticated users only (for admin panel)

### Bids (`/bids/{bidId}`)
- **Read**: Public (anyone can see current highest bids)
- **Create/Update**: Anyone with valid bid data (bid amount, bidder name, email, phone, timestamp)
- **Delete**: Denied (preserve bid integrity)
- **Validation**: 
  - Bid must be a positive number
  - All required fields must be present

### Bid History (`/history/{itemId}/entries/{entryId}`)
- **Read**: Public (anyone can view bid history)
- **Create**: Anyone with valid history entry data
- **Update/Delete**: Denied (preserve auction history)

### Users (`/users/{userId}`)
- **Read**: User can only read their own profile
- **Write**: User can only create/update their own profile
- **Delete**: Denied

### Admin (`/admin/{document}`)
- **Read/Write**: Authenticated users only
- Note: Should add proper admin role checking in production

## Deployment

### Option 1: Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database
4. Click on "Rules" tab
5. Copy the contents of `firestore.rules`
6. Paste and publish

### Option 2: Firebase CLI
```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## Security Best Practices

### Current Implementation
✅ Public read access for items and bids (required for auction visibility)
✅ Data validation for bids (ensures data integrity)
✅ Immutable history (prevents tampering with bid records)
✅ User-specific profile access

### Recommended Enhancements for Production

1. **Add Firebase Authentication**
   ```javascript
   // Replace anonymous bid submission with authenticated users
   allow create: if request.auth != null
                 && request.auth.token.email_verified == true;
   ```

2. **Implement Admin Role Checking**
   ```javascript
   // In items_list and admin collections
   function isAdmin() {
     return request.auth != null 
            && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
   }
   
   allow write: if isAdmin();
   ```

3. **Add Rate Limiting**
   - Use Firebase Functions to track bid submission rates
   - Prevent spam and abuse

4. **Bid Amount Validation**
   ```javascript
   // Ensure new bid is higher than current bid
   function isValidBid() {
     let currentBid = get(/databases/$(database)/documents/bids/$(bidId)).data.bid;
     return request.resource.data.bid > currentBid;
   }
   ```

5. **Time-based Restrictions**
   ```javascript
   // Prevent bids after auction end time
   function auctionIsActive() {
     let item = get(/databases/$(database)/documents/items_list/$(itemId));
     return request.time < item.data.endTime;
   }
   ```

## Testing Security Rules

Use the Firebase Emulator Suite to test rules locally:

```bash
# Install emulators
firebase init emulators

# Start emulators
firebase emulators:start

# Run tests (you'll need to create test files)
npm test
```

## Important Notes

⚠️ **Current Setup**: The app currently uses localStorage for user info and doesn't require Firebase Authentication. This is suitable for a small-scale, trusted audience auction.

⚠️ **For Production**: Implement proper Firebase Authentication and add the recommended security enhancements above.

⚠️ **Data Privacy**: Email and phone numbers are currently stored in bid records. Consider privacy regulations (GDPR, etc.) for your region.

## Monitoring

Monitor your Firestore usage and security:
1. Firebase Console → Firestore Database → Usage tab
2. Check for unusual patterns
3. Review security rules regularly
4. Monitor costs and quotas
