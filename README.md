# MAÇIM – AstroTurf Match & Player Finder Mobile Application

MAÇIM is a mobile application developed as a graduation project.  
The application aims to bring players, teams, opponents, and AstroTurf fields together on a single platform.

## 📱 Project Description

MAÇIM allows users to:
- Find players or teams
- Create player and match listings
- Communicate with listing owners via messaging
- View nearby AstroTurf fields within a 5 km radius
- Get directions and make reservations for AstroTurf fields
- Manage their profile, listings, and reservations

The application is designed to simplify the organization of amateur football matches.

## 🛠️ Technologies Used

### Frontend
- React Native
- TypeScript
- Expo
- Expo Router

### Backend
- Node.js
- Express.js
- SQLite (or your database if different)
- JWT (JSON Web Token) for authentication
- bcrypt for password hashing

### Other Tools
- Git & GitHub
- Various artificial intelligence tools were used during the development process

## 🔐 Authentication

- User registration and login are handled via backend API
- JWT-based authentication is used
- Secure password hashing with bcrypt

## 📂 Project Structure

```txt
macim/
│
├── macim-backend/        # Node.js + Express backend
│
├── app/                 # React Native frontend
│
├── assets/              # Images and static files
│
├── README.md
└── package.json
