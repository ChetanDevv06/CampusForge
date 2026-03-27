# CampusLoop 🔄

**CampusLoop** is a smart campus exchange platform designed to bridge the gap between students. Whether you've lost an item, want to sell a textbook, or need to learn a new skill, CampusLoop is the go-to app for your university community.

---

## 🚀 Features

- 🔍 **Lost & Found:** Report lost items or help others find theirs.
- 🛍️ **Marketplace:** Buy and sell items directly within your campus.
- 💡 **Skill Exchange:** Teach what you know, learn what you don't.
- 💬 **Real-time Chat:** Communicate safely with other students.
- ⭐ **Ratings & Reviews:** Build trust within the community.
- 👤 **Profile Management:** Customize your avatar and display your campus credentials.

---

## 🛠 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/go) app on your mobile device (to test on physical hardware)

---

## 🏁 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/ChetanDev06/CampusLoop.git
cd CampusLoop
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory and add your Firebase configuration. You can use the template below:

```env
EXPO_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
EXPO_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
```

> [!IMPORTANT]
> To get these values, create a new project on the [Firebase Console](https://console.firebase.google.com/), enable **Authentication**, **Cloud Firestore**, and **Storage**, and then add a "Web App" to your project settings.

### 4. Run the Application
```bash
npx expo start
```

---

## 📱 Running on Different Systems

- **Android Emulator / iOS Simulator:** Press `a` (for Android) or `i` (for iOS) in the terminal after starting Expo.
- **Physical Device:** Scan the QR code displayed in the terminal using the **Expo Go** app (Android) or the **Camera app** (iOS).
- **Web:** Press `w` to open the project in your browser.

---

## 🏗 Project Structure

- `app/` - Contains all screens and routing logic (Expo Router).
- `contexts/` - Global state management (Auth, Profile).
- `constants/` - Theme, colors, and layout configurations.
- `utils/` - Helper functions for Firebase, storage, and chat.
- `firebaseConfig.ts` - Main Firebase initialization.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📧 Contact
**Chetan** - [GitHub](https://github.com/ChetanDev06)

Project Link: [https://github.com/ChetanDev06/CampusLoop](https://github.com/ChetanDev06/CampusLoop)
